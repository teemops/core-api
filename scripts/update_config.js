/**
 * Updates the main config value at ../app/config/config.json
 * 
 * Purpose:
 * - change config.json values
 * 
 * Parameters:
 * - key: which key
 * - value: which new value to enter
 * 
 */
const DEBUG_TIMEOUT=10;
const dest='./app/config/config.json'

var file=require("../app/drivers/file");
// if (process.argv.length<2){
//     console.log("Arguments need to be supplied as follows");
//     help();
//     process.exit();
// }

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
    key: process.argv[2],
    value: process.argv[3]
};

function help(){
    console.log(
`
node update_config.js <key> <value>
`
    )
}

/**
 * Adds or updates a value to config file based on the key name and value derived from value argument
 * 
 * @param {*} key Name of field in config file to update
 * @param {*} source Source file to use 
 */
const add_config=async function(key, value){
    try{
        var secret=value;
        //array of config hierarchical value (e.g. s3.appsometinng)
        var full_dest_item=key.toString().split(".");
        //get top level value
        var currentValue=await file.getConfig(full_dest_item[0], dest);

        if(full_dest_item.length>1){
            if(currentValue==undefined){
                //empty object needs to be created
                currentValue={};
            }
            currentValue[full_dest_item[1]]=secret;
        }else{
            currentValue=secret;
        }
        
        const updateConfig=await file.updateConfig(full_dest_item[0], currentValue, dest);
        if(updateConfig){
            process.exit(0);
        }else{
            process.exit(1);
        }
        
    }catch(e){
        throw e
    }

}

/**
 * Updates the config file as follows:
 * key: somekey
 * value: value
 * 
 */
setTimeout(function(){
    add_config(args.key, args.value).then(function(){
        console.log('Config Item added');
    }).catch(function(error){
        console.log(error);
        console.error("ConfigError"+JSON.stringify(error));
        process.exit(1);
    });

}, DEBUG_TIMEOUT);

