import Help from "./eepHelper"

export default function(eep: string, data: string) {
	var ret = null
	var eepa = eep.split("-")
	var choice = eepa[0]
	var func = eepa[1]
	var type = eepa[2]
	var typeNr = parseInt(type, 16)

	if (choice === "d2" && func === "32" && typeNr == 2) {
		var rawVal1 = parseInt(data.substring(2,5),16)
		var rawVal2 = parseInt(data.substring(5,8),16)
		var rawVal3 = parseInt(data.substring(8,11),16)
		var powerFailBit = Help.extractBitValue(0,7,1,data.substring(0,2))
		var scaleBit = Help.extractBitValue(0,6,1,data.substring(0,2))
		var divisor = scaleBit == 1 ? 10 : 1;

		return [{
			type: "scale",
			unit: "",
			value: 1 / divisor
		}, {
			type: "current",
			unit: "A",
			value: rawVal1 / divisor
		}, {
			type: "current",
			unit: "A",
			value: rawVal2 / divisor
		}, {
			type: "current",
			unit: "A",
			value: rawVal3 / divisor
		}, {
			type: "power_fail",
			unit: "",
			value: powerFailBit
		}]
	}

	return null
}
