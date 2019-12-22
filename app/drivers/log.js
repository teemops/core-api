/**
 * Custom logger for events - debug, info, alert, warning, critical etc...
 */


if(process.env=='development'){
    var LOG_LEVEL='DEV'; //defaults to DEBUG which is dev
}else{
    var LOG_LEVEL='WARNING'; //defaults to WARNING which is production and don't console.out debug logs
}

/**
 * Lists all statuses, codes and messages for exceptions
 * based on https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */
module.exports.EXCEPTIONS={
    DUPLICATE:{
        code: 4000,
        status: 403,
        message: 'DUPLICATE ENTRY ALREADY EXISTS'
    },
    DB_ERROR:{
        code: 5001,
        status: 500,
        message: 'GENERIC DATABASE ERROR'
    },
    NOT_FOUND:{
        code: 4001,
        status: 404,
        message: 'RESOURCE NOT FOUND'
    }
};

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
