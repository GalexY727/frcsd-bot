const fs = require("fs");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

// Path to the reactionMap.json file
const reactionMapPath = path.join(__dirname, "../", "reactionMap.json");

function loadReactionMap() {
    try {
        const rawData = fs.readFileSync(reactionMapPath, "utf8");
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Error loading reactionMap.json", error);
        return {};
    }
}

async function gitCommit(key, value) {
    try {
        await exec(`git add ${reactionMapPath}`);
        await exec(`git commit -m "Update reactionMap.json: ${key}: ${value}" --author="Server Admin <ruhmit@ruhmit.com>"`);
        await exec("git push origin main");
        console.log(`Pushed changes to remote: ${key}: ${value}`);
    } catch (error) {
        console.error(`exec error: ${error}`);
    }
}

// Export the functions
module.exports = {
    loadReactionMap,
    gitCommit,
    reactionMapPath
};
