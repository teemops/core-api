/**
 * Secrets script which is used by main teemops setup.sh
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
    dest: process.argv[3],
    key: process.argv[4]
};

function help(){
    console.log(
`
node update_secret.js <name> <value>
`
    )
}

/**
 * Adds a secret to config file based on the key name and value derived from source file
 * 
 * @param {*} key Name of field in config file to update
 * @param {*} source Source file to use 
 */
const add_secret=async function(key, source, dest){
    
    try{
        var secret=await file.readLine(source);
        //array of config hierarchical value (e.g. s3.appsometinng)
        var full_dest_item=key.toString().split(".");
        //get top level value
        var currentValue=await file.getConfig(full_dest_item[0], dest);

        if(full_dest_item.length>=1){
            if(currentValue==undefined){
                //empty object needs to be created
                currentValue={};
            }
            currentValue[full_dest_item[1]]=secret;
        }else{
            currentValue=secret;
        }
        
        const updateConfig=await file.updateConfig(full_dest_item[0], currentValue, dest);
    }catch(e){
        throw e
    }

}

console.log('waiting...');
/**
 * Updates the config file as follows:
 * source: TopsMetaBucketName
 * output: s3.app_bucket
 * 
 */
setTimeout(function(){
    add_secret(args.key, args.source, args.dest).then(function(){
        console.log('Secret added');
    }).catch(function(error){
        console.log(error);
        console.error("SecretsError");
    });

}, DEBUG_TIMEOUT);



