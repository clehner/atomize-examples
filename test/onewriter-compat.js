// atomize-translate onewriter.js onewriter-compat.js atomize result console

var obj, cont, writeCount = 9, expectedWrite, atomize;
function writing () {
    atomize.atomically(function () {
        atomize.assign(obj, "x", atomize.access(obj, "x") + 1);
        if (atomize.access(obj, "x") !== expectedWrite) {
            throw "ItWentWrong";
        }
        return atomize.access(obj, "x");
    }, function (result) {
        expectedWrite += 1;
        writeCount -= 1;
        if (writeCount === 0) {
            console.log("Stopping writing at " + result);
            writeCount = 9;
            cont(false);
        } else {
            console.log("Wrote " + result);
            cont(true);
        }
    });
}
function reading () {
    atomize.atomically(function () {
        if (0 === (atomize.access(obj, "x") % 10)) {
            atomize.assign(obj, "x", atomize.access(obj, "x") + 1);
            return {grabbed: true, value: atomize.access(obj, "x")};
        } else {
            return {grabbed: false, value: atomize.access(obj, "x")};
        }
    }, function (result) {
        if (result.grabbed === true) {
            expectedWrite = (atomize.access(obj, "x") + 1);
            console.log("Grabbed writer at " + result.value);
        } else {
            console.log("Read " + result.value);
        }
        cont(result.grabbed);
    });
}
cont = function (writer) {
    if (writer) {
        setTimeout("writing();", 1000 / 60);
    } else {
        setTimeout("reading();", 1000 / 60);
    }
};
function start () {
    atomize = new Atomize("http://localhost:9999/atomize");
    atomize.onAuthenticated = function () {
        atomize.atomically(function () {
            if ((undefined === atomize.access(atomize.root, "obj")) || (undefined === atomize.access(atomize.access(atomize.root, "obj"), "x"))) {
                atomize.assign(atomize.root, "obj", atomize.lift({x: 1}));
                return {writer: true, obj: atomize.access(atomize.root, "obj")};
            } else {
                return {writer: false, obj: atomize.access(atomize.root, "obj")};
            }
        }, function (result) {
            obj = result.obj;
            if (result.writer) {
                expectedWrite = 2;
            }
            cont(result.writer);
        });
    };
    atomize.connect();
}
