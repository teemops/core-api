/**
 * Setup script which is used by main teemops setup.sh
 * (https://github.com/teemops/teemops/blob/master/setup.sh)
 * to generate config files values
 * 
 * Purpose:
 * - change config.json values
 * 
 * Parameters:
 * - config_source: A file which has config values to be updated
 * - config_dest: Destination config files to be updated
 * - spec_file: The location of a spec file of variables to be updated
 * 
 */
const DEBUG_TIMEOUT=0;
/**
 * Fields to update
 */
const fields=[
    {
        source: 'TopsMetaBucketName',
        dest: 's3.app_bucket'
    }
];

if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 

var file=require("../app/drivers/file");
if (process.argv.length<3){
    console.log("Arguments need to be supplied as follows");
    help();
    process.exit();
}

if (process.argv[2]=="help"){
    help();
}
/**
 * args={
 *  cwd: Current working directory script is running in,
 *  source: Source file path for where config values come from,
 *  output: Output folder where config values to be 
 * }
 */
var args={
    cwd: process.argv[1],
    source: process.argv[2],
    dest: process.argv[3]
};

function help(){
    console.log(
`
node setup.js <source_config_path> <dest_config_path>
`
    )
}

const update_config=async function(source_item, dest_item, source, dest){
    
    var sourceFileValue=await file.getConfig(source_item, source);
    
    var parent_item;
    //array of config hierarchical value (e.g. s3.app.something)
    var full_dest_item=dest_item.toString().split(".");
    //get top level value
    var currentValue=await file.getConfig(full_dest_item[0], dest);
    console.log(currentValue)
    if(full_dest_item.length>=1){
        console.log(full_dest_item);
        console.log("FULL DEST ITEM!!!!")
        currentValue[full_dest_item[1]]=sourceFileValue;
    }else{
        currentValue=sourceFileValue;
    }
    
    const updateConfig=await file.updateConfig(full_dest_item[0], currentValue, dest);

}

console.log('waiting...');
/**
 * Updates the config file as follows:
 * source: TopsMetaBucketName
 * output: s3.app_bucket
 * 
 */
setTimeout(function(){
    fields.forEach(function(value, index, array){
        update_config(value.source, value.dest, args.source, args.dest).then(function(){
            console.log("configuration updated");
        }).catch(function(error){
            console.log(error);
            console.error("ConfigError");
        });
    })


    
}, DEBUG_TIMEOUT);



