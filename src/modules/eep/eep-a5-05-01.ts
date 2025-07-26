import Help from "./eepHelper"
export default function(eep: string, data: string){
	var ret=null
	var eepa=eep.split("-")
	var choice=eepa[0]
	var func=eepa[1]
	var type=eepa[2]
	var typeNr=parseInt(type,16)
	if (eep !== "a5-05-01") return null;
	var val1 = Help.extract10BitValue(1,0,1023,500,1150,data)
	var trigger = "heartbeat"
	var trg= Help.extractBitEnum(0,1,1,data,["heartbeat","event"])
	return [{
		type:"barometric_pressure",
		unit:"hPa",
		value: val1
	},{
		type: "trigger",
		value: trg,
		unit:""
	}]
}
