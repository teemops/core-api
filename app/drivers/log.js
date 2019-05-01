/**
 * Custom logger for events - debug, info, alert, wanring, critical etc...
 */

module.exports.LOG_TYPES={
    ERROR:'ERROR',
    WARNING: 'WARNING'  
};;
module.exports.out=async function(errCode,errMsg, Type='DEBUG'){
    
    if(Type==this.LOG_TYPES.ERROR){
        throw {
            code:errCode,
            message:errMsg
        };
    }
    console.log(Type+": "+errCode+" "+errMsg);
}