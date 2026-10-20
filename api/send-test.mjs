import {sendTest} from '../lib/send.mjs';
export default {fetch(request){return sendTest(request,process.env);}};
