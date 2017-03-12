var Help = require("./eepHelper.js")
module.exports=function(eep,data){
	var begin = eep.split("-");

	//24 bytes of data
	if(begin[0] === "d1" && data.length = 24*2){
		return [{
			type:"contactair",
			serial:data.substring(0, 6*2),
			data:data
		}]
	}
	return undefined
}
