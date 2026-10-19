import {send} from '../lib/send.mjs';
export default {fetch(request){return send(request,process.env);}};
