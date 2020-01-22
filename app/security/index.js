const yaml=require('js-yaml');
const file= require('../../app/drivers/file');
var jwtController = require("../../app/controllers/JWTController.js");
var myJWT=jwtController();
var settings;

//These are the default resources all roles have access to
const routes={
    '/apps': ['my.apps'],
    '/credentials': ['my.credentials'],
    '/usercloudconfigs': ['my.configs']
};
const actions={
    GET: 'view',
    POST: 'edit',
    PUT: 'add',
    DELETE: 'delete'
};

/**
 * checks if a user has access to a resource based on following:
 * role
 * userid
 * This check is typically done before any routes (in server.js)
 * 
 */
module.exports = async function(req, resource){
    if(settings==undefined){ 
        settings = yaml.safeLoad(await file.read('./app/config/security.yaml'));
    }
    var action=getActionFromMethod(req.method);
    const user=getJWTValues(req);
    if(await roleHasAccess(user, resource, action) && 
        await userHasAccess(user, req.params, action)){
        return true;
    }else{
        throw {
            code: 403,
            message: 'Access Denied'
        };
    }
}

function getActionFromMethod(method){
    if(actions[method]!=undefined){
        return actions[method];
    }else{
        return 'none';
    }
    
    // switch(method){
    //     case 'GET':
    //         return 'view';
    //         break;
    //     case 'POST':
    //         return 'edit';
    //         break;
    //     case 'PUT':
    //         return '';
    //         break;
    // }
}

function getJWTValues(req){
    var token = req.headers['x-access-token'];
    return myJWT.verifyJWT(token);
}

/**
 * Confirm whether or not a token's role and userid has access to a resource
 * 
 * @param {*} token user's JWT
 * @param {*} resource path to resource
 */
async function roleHasAccess(user, resource, action) {
    var permissions=[];
    if (user) {
        //get permissions for user based on role and the action -see config/security.yaml
        permissions=settings.roles[user.role].permissions[action];
        const base=getbasePath(resource);
        const isRoleAllowed=canRoleAccessPath(permissions, base);
        return isRoleAllowed;
    }else{
        return false;
    }
};

async function userHasAccess(user, params, action){
    if(user){
        //always return true if users userid =requested userid
        if(user.userid==params.userId){
            return true;
        }else{
            /**
             * TODO: currently we return false but future feature is to add organisations
             * which will allow us to invite users to Teem Ops
             * and also assign them roles... 
             * 
             * Example future logic to be implemented here:
             * 
             * Filter users organisations from database, 
             * Filter requested userids organisation from database...
             * 
             * If there is a match then check the logged in user's role for access
             * (e.g. if they can view they can view but not add or edit)
             * 
             * */
            return false;
        }
    }else{
        return false;
    }
}

function canRoleAccessPath(permissions, base){
    //get allowed 
    const routesAllowed=permissions.find(route=>route==routes[base]);

    return routesAllowed!==undefined;
}

function getbasePath(fullPath){
    var pathArray=fullPath.split("/");
    return "/"+pathArray[2];
}

