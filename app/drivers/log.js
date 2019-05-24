/**
 * Custom logger for events - debug, info, alert, warning, critical etc...
 */
if(process.env=='development'){
    var LOG_LEVEL='DEV'; //defaults to DEBUG which is dev
}else{
    var LOG_LEVEL='WARNING'; //defaults to WARNING which is production and don't console.out debug logs
}

module.exports.LOG_TYPES={
    ERROR:'ERROR',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

module.exports.out=async function(errCode,errMsg, Type='DEBUG'){
    
    if(Type==this.LOG_TYPES.ERROR){
        throw {
            code:errCode,
            message:errMsg
        };
    }
    console.log(Type+": "+errCode+" "+errMsg);
}

module.exports.setLogLevel=function(level){
    LOG_LEVEL=level;
}