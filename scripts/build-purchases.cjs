const {buildSync}=require('esbuild');
const path=require('node:path');
buildSync({entryPoints:[path.join(__dirname,'../native/shop-entry.js')],outfile:path.join(__dirname,'../www/native-shop.js'),bundle:true,format:'iife',platform:'browser',target:['safari15','chrome100'],minify:false,sourcemap:false,legalComments:'eof'});
