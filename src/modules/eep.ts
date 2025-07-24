// 	   This file is part of node-enocean.

//     node-enocean. is free software: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

//     node-enocean. is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.

//     You should have received a copy of the GNU General Public License
//     along with node-enocean.  If not, see <http://www.gnu.org/licenses/>.

import eepf60203 from "./eep/eep-f6-02-03";
// 1BS
import eepd50001 from "./eep/eep-d5-00-01";
//  4BS
import eepa502xx from "./eep/eep-a5-02-xx";
import eepa50210bit from "./eep/eep-a5-02-10bit";
import eepa504xx from "./eep/eep-a5-04-xx";
import eepa50410bit from "./eep/eep-a5-04-10bit";
import eepa50501 from "./eep/eep-a5-05-01";
import eepa50601 from "./eep/eep-a5-06-01";
import eepa50602 from "./eep/eep-a5-06-02";
import eepa50603 from "./eep/eep-a5-06-03";
import eepa50701 from "./eep/eep-a5-07-01";
import eepa50904 from "./eep/eep-a5-09-04";
import eepa51006 from "./eep/eep-a5-10-06";
import eepa51102 from "./eep/eep-a5-11-02";
import eepa51201 from "./eep/eep-a5-12-01";
import eepa53001 from "./eep/eep-a5-30-01";
// VLD
import eepd23202 from "./eep/eep-d2-32-02";
// MSC
import eepd103cx from "./eep/eep-d1-03-cx";
// Contact Air
import eepd1ff00 from "./eep/eep-d1-ff-00";


export default [
    // RPS
    eepf60203,
    // 1BS
    eepd50001,
    //  4BS
    eepa502xx,
    eepa50210bit,
    eepa504xx,
    eepa50410bit,
    eepa50501,
    eepa50601,
    eepa50602,
    eepa50603,
    eepa50701,
    eepa50904,
    eepa51006,
    eepa51102,
    eepa51201,
    eepa53001,
    // VLD
    eepd23202,
    // MSC
    eepd103cx,
    // Contact Air
    eepd1ff00
];