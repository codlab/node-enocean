import Help from "./eepHelper"
export default function(eep: string, data: string){
	var ret=null
	var eepa=eep.split("-")
	var choice=eepa[0]
	var func=eepa[1]
	var type=eepa[2]
	var typeNr=parseInt(type,16)
	if(eep!=="a5-06-01") return null;
	
	const val1=Help.extractByteValue(1,0,255,600,60000,data)
	const val2=Help.extractByteValue(2,0,255,300,30000,data)
	const val3=Help.extractByteValue(3,0,255,0,5.1,data)
	var select=Help.extractBitValue(0,0,1,data)

	const obj = select==0 ? {
		type:"illumination",
		unit:"lux",
		value: val1
	} : {
		type:"illumination",
		unit:"lux",
		value: val2
	}

	return [obj, {
		type:"voltage",
		unit:"V",
		value: val3
	}]
}
