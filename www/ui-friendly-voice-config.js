/* Public release capability probe for the approved game-server origin.
 * Keep credentials on the server. This file contains no Agora certificate or token.
 * An isolated QA bootstrap may provide its configuration before this file loads.
 */
(function(root){
 'use strict';
 if(root.MJ_FRIENDLY_VOICE_CONFIG===undefined)root.MJ_FRIENDLY_VOICE_CONFIG=Object.freeze({enabled:true,endpoint:'https://waggif-baloot.samisalimhdmaol.workers.dev',allowLocalhost:false});
})(window);
