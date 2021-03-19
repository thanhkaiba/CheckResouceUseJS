#!/usr/bin/env node
const fs = require("fs")
const path = require("path");
const events = require('events');
const eventEmitter = new events.EventEmitter();
eventEmitter.on('load-config-done', (filePath) => {
    resolve(filePath);
})

console.log("\n" +
    "/***\n" +
    " *     _    _        _  _            \n" +
    " *    | |  / )      (_)| |           \n" +
    " *    | | / /  ____  _ | | _    ____ \n" +
    " *    | |< <  / _  || || || \\  / _  |\n" +
    " *    | | \\ \\( ( | || || |_) )( ( | |\n" +
    " *    |_|  \\_)\\_||_||_||____/  \\_||_|\n" +
    " *                                   \n" +
    " */\n")


const EXT_NAME = '.js';
const copiedMap = {};
const folder_map = {};
let search_path = {};
const args = process.argv.slice(2);

let filePath = args[0];

readConfig();
const res_map = {};

function readConfig() {
    let rawData = fs.readFileSync(path.join(__dirname, './config.json'));
    /**
     *
     * @type {{resPath: string, build_config: string, searchPath: Object}}
     */
    let config = JSON.parse('' + rawData);
    search_path = config.searchPath;
    //load build config
    if (config.build_config != null) {
        fs.readFile(config.build_config, 'utf8', (err, someText) => {

            if (err) {
                console.error(err);
                return;
            }
            eval(someText
                .replace('\'use strict\';', '')
                .replace("\"use strict\";", '')
                .replace(/(const|let)\s+BuildConfig/g, 'var BuildConfig')
                .replace(/cc\.log/g, 'console.log'));

            loadResMap(config.resPath, BuildConfig);


        });
    } else {
        loadResMap(config.resPath);
    }
}

function loadResMap(resPath, BuildConfig) {
    if (resPath == null || Object.keys(resPath).length === 0) {
        eventEmitter.emit('load-config-done', filePath);
    }
    for (let key in resPath) {
        //load resource image file
        if (resPath.hasOwnProperty(key)) {
            fs.readFile(resPath[key], 'utf8', (err, someText) => {

                if (err) {
                    console.error(err);
                    return;
                }

                const regex = new RegExp('(?:var|const)\\s+' + key + '(?:.|\\n|\\r)*?({(?:.|\\n|\\r)*?})', 'm')
                let jsonString = someText.match(regex)[1];
                eval("res_map['" + key + "'] =" + jsonString);

                if (Object.keys(resPath).indexOf(key) === Object.keys(resPath).length - 1) {
                    eventEmitter.emit('load-config-done', filePath);
                }
            });

        }
    }
}

filePath = convertPath(filePath);

if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
}


function resolve(filePath) {
    if (!is_dir(filePath)) {
        readJs(filePath);
    } else {
        const filePaths = fs.readdirSync(filePath);
        filePaths.forEach(file => {
            resolve(convertPath(path.join(filePath, file)));
        });
    }

}


function convertPath(filePath) {
    return filePath.replace(new RegExp('\\\\', 'g'), path.sep).replace(new RegExp('\/', 'g'), path.sep);
}


function copyFile(pathToFile, pathToNewDestination) {
    if (!copiedMap[pathToFile]) {
        copiedMap[pathToFile] = true;

        if (fs.existsSync(pathToFile) && !fs.existsSync(pathToNewDestination)) {
            ensureDirectoryExistence(pathToNewDestination);
            fs.copyFile(pathToFile, pathToNewDestination, (err) => {
                if (err) console.error(err.message);
                console.log('COPIED ', pathToFile, '--->>> ->>>',pathToNewDestination);
            });
        } else {
            console.error('File not found: ', pathToFile);
        }
    }
}

const output = new Set();

/**
 *
 * @param filePath
 * @param detail
 * @returns {{finalPath: string, des_path: any}|null}
 */
function resolvePath(filePath, detail) {
    filePath = convertPath(filePath);
    let finalPath;
    finalPath = undefined;
    let des_path = undefined;
    const path_arrays = filePath.split(path.sep);

    if (search_path[path_arrays[0]] != null) {
        finalPath = path.join(search_path[path_arrays[0]].path, filePath);
        des_path = path.join(search_path[path_arrays[0]].output, filePath);
    }

    if (finalPath != null) {
        return {finalPath: finalPath, des_path: des_path};
    } else {
        console.error("Find resource but can't find path " + filePath, 'in line: ', detail);
        return null;
    }


}

function readJs(filePath) {
    const ext = path.extname(filePath);
    if (ext === EXT_NAME) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(err)
                return
            }

            const someText = data.replace(/(\r\n|\n|\r)/gm, "");
            const regex = /"([\w\/]+\.\w+)"/g;
            let matches;
            while (matches = regex.exec(someText)) {
                const path = resolvePath(matches[1], matches[0]);

                if (path != null && !output.has(path)) {
                    output.add(path);
                    copyFile(path.finalPath, path.des_path);
                }
            }


            for (let resMapKey in res_map) {
                const resRegex = new RegExp(resMapKey + '\\n*?\\r*?.(\\w+)', 'gm')
                while (matches = resRegex.exec(someText)) {

                    const path = resolvePath((res_map[resMapKey][matches[1]]), matches[0]);

                    if (path != null && !output.has(path)) {
                        output.add(path);
                        copyFile(path.finalPath, path.des_path);
                    }
                }
            }
        })


    } else {
        console.error('File extension not support', ext);
    }
}


function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (folder_map[dirname] || fs.existsSync(dirname)) {
        folder_map[dirname] = true;
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function is_dir(path) {
    try {
        const stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}



