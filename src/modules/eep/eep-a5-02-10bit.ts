import Help from "./eepHelper"
export default function(eep,data){
	var eepa=eep.split("-")
	var choice=eepa[0]
	var func=eepa[1]
	var type=eepa[2]
	var typeNr=parseInt(type,16)
	if(choice==="a5" && func==="02" && sensors[type]!==undefined){
		return [{
			type:"temperature",
			unit:"°C",
			value: Help.extract10BitValue(1,1023,0,sensors[type].min,sensors[type].max,data)
		}]
	}
	return null
}
var sensors={
	20:{min:-10,max:41.2}, //10
	30:{min:-40,max:62.3}, //20
}
