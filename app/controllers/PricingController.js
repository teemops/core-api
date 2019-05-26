

var mysql = require("../../app/drivers/mysql.js");
var mydb= mysql();

module.exports=function(){
    return {
        getInstanceTypes: async function(region){
            var sql = "CALL sp_getInstanceTypes(?)";

            var params = [region];
            try{
                const results= await mydb.getRows(sql, params);

                return results;
                
            }catch(e){
                throw e;
            }
            
        }
    };
}