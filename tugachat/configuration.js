var fs = require("fs");
console.log("Starting");
var contents = fs.readFileSync("./files/config.json");
console.log("Contents: " + contents);
var config = JSON.parse(contents);
console.log("Config: ", config);
console.log("Username: ", config.username);