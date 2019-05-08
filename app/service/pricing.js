if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
const PRODUCTS_FILTER='PriceList[].{vcpu: product.attributes.vcpu,Memory:product.attributes.memory, SW: product.attributes.preInstalledSw, location: product.attributes.location, instanceType: product.attributes.instanceType, term: terms, sku: product.sku, os:product.attributes.operatingSystem, meta:product}';
var jmespath=require('jmespath');
var resourceController=require("../controllers/ResourceController");
var mysql = require("../../app/drivers/mysql.js");
var jmespath = require('jmespath');
var mydb= mysql();
var resource=resourceController();
var config = require('config-json');
config.load('./app/config/config.json');
resource.init(config);
mydb.init();
var code=0;
var done=false;
var pages=1;
const myService=async function service(callback){
    var task, params,region, dbResult, nextToken, lastToken;
    const filter=true;
    region='us-east-1';
    try{
        while(!done){
            if(lastToken!=null && nextToken==null){
                done=true;
            }{
                task='getProducts';
                params={
                    ServiceCode: 'AmazonEC2',
                    Filters: [
                        {
                            Field: 'termType',
                            Type: 'TERM_MATCH',
                            Value: 'OnDemand'
                        },
                        {
                            Field: 'preInstalledSw',
                            Type: 'TERM_MATCH',
                            Value: 'NA'
                        },
                        {
                            Field: 'tenancy',
                            Type: 'TERM_MATCH',
                            Value: 'Shared'
                        }
                    ]
                };
                if(nextToken!=null){
                    params.NextToken=nextToken;
                    lastToken=nextToken;
                }
                var result=await resource.priceTask(null, null, task, params, region);
                if(result!=null){
                    if(filter){
                        console.log("Filtering...\n");
                        nextToken=result.NextToken;
                        result=jmespath.search(result, PRODUCTS_FILTER);
                        dbResult=addProductsToDB(result);
                        console.log("Next token: "+nextToken);
                        console.log("Last Token: "+lastToken);
                        console.log("Current Page: "+pages);
                        pages++;
                    }
                }else{
                    console.log('Pricing Task returned no results');
                }
            }
        }
    }catch(e){
        console.log("Error: "+e);
        code=1;
        finish();
    }
    //pages
    console.log("Finished");
}
myService(function(err, result){
    console.log("Completed");
    console.log(result);
});

function waiting(ms){
    return new Promise(resolve=>setTimeout(resolve, ms));
}

function finish(){
    if(code===1){
        console.log('exiting');
        process.exit();
    }
}

async function addProductsToDB(data){
    var products=[];
    var dbResult;
    products=data;

    var i=0;
    products.forEach(async function(value, index){
        try{
            var newProduct=transformProductForDb(value);
            dbResult=await addProductLineToDB(newProduct);
            if(dbResult!=null){
                console.log("Product added with ID "+dbResult + " Instance Type: "+newProduct.instanceType);
            }
            
        }catch(e){
            throw e;
        }
    });
    return true;
}

function getPriceDimensions(product){
    for(attribute in product['term']['OnDemand']){
        var priceDimensions=product['term']['OnDemand'][attribute].priceDimensions;
        for(price in priceDimensions){
            //console.log(JSON.stringify(priceDimensions[price], null, 4));
            return priceDimensions[price];
        }
    }
}

function transformProductForDb(product){
    var priceDimensions=getPriceDimensions(product);
    var productMeta={
        product: product.meta,
        terms: product.term
    };
    var newProduct= {
        instanceType: product.instanceType,
        hourlyPrice: priceDimensions.pricePerUnit.USD,
        region: product.location,
        usageType: "OnDemand",
        memory:product.Memory,
        vcpu: product.vcpu,
        sku:product.sku,
        os:product.os,
        meta: JSON.stringify(productMeta)
    };
    // console.log(JSON.stringify(newProduct, null, 4));
    return newProduct;
}

/**
 * Adds product to pricing table
 * 
 * product={
 *      instanceType: "t3.micro",
 *      hourlyPrice: "2.30",
 *      region: "us-west-2",
 *      usageType: "ondemand",
 *      ...
 * }
 */
async function addProductLineToDB(product){
    var sql="CALL sp_insertPricing(?,?,?,?,?,?,?,?, ?, ?)";
    var params = [1,product.instanceType,product.hourlyPrice,product.region,product.usageType, product.memory, product.vcpu, product.sku, product.os, product.meta];
    var updateResult;
    
    try{
        updateResult=await mydb.insertSPPromise(sql, params);
        if(updateResult!=null){
            return updateResult;
        }
    }catch(e){
        console.log(e);
        throw e;
    }
}


