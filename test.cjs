const { Worker, isMainThread } = require('node:worker_threads');

if(isMainThread){

	// This re-loads the current file inside a Worker instance.
	new Worker(__filename);
	console.log(__filename);

} else {

	console.log('Inside Worker!');
	console.log(isMainThread); // Prints 'false'.

}