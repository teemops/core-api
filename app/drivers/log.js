/**
 * Custom logger for events - debug, info, alert, warning, critical etc...
 */
var file=require('./file');

if(process.env=='development'){
    var LOG_LEVEL='DEV'; //defaults to DEBUG which is dev
}else{
    var LOG_LEVEL='WARNING'; //defaults to WARNING which is production and don't console.out debug logs
}

class LogException{
    constructor(code, status, message){
        this.code=code;
        this.status=status;
        this.message=message;
    }
    get(){
        return {
            code: this.code,
            status: this.status,
            message: this.message
        }
    }
}

class LogType{

}

/**
 * Lists all statuses, codes and messages for exceptions
 * based on https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */
module.exports.EXCEPTIONS={
    generic: new LogException(
        5000,
        500,
        'GENERAL ERROR'
    ),
    forbidden: new LogException(
        4003,
        403,
        'ACCESS TO RESOURCE FORBIDDEN'
    ),
    duplicate: new LogException(
        4000,
        403,
        'DUPLICATE ENTRY ALREADY EXISTS'
    ),
    dbError: new LogException(
        5001,
        500,
        'GENERIC DATABASE ERROR'
    ),
    notFound: new LogException(
        4001,
        404,
        'RESOURCE NOT FOUND'
    ),
    missing: new LogException(
        4002,
        400,
        'MISSING PARAMETER'
    )
};

module.exports.LOG_TYPES={
    ERROR:'ERROR',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

module.exports.error=function(exception, original){
    var output=exception.get();
    output['details']=original;
    throw {
       error: output
    };
}

module.exports.out=function(errCode,errMsg, Type='DEBUG'){
    console.log(Type+": "+errCode+" "+errMsg);
}

module.exports.setLogLevel=function(level){
    LOG_LEVEL=level;
}
