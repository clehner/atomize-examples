// atomize-translate unittests.js unittests-compat.js atomize '$(document)' NiceException Error

var atomize = new Atomize();

$(document).ready(function(){

    function NiceException() {};
    NiceException.prototype = Error.prototype;

    var niceException = new NiceException();

    test("Empty Txn",
         function() {
             atomize.atomically(function () {});
         });

    test("Returns result",
         function() {
             var x = {};
             atomize.atomically(function() {
                 return x;
             }, function (y) {
                 strictEqual(x, y, "Object has been cloned?!");
             });
         });

    test("Modification of non-TVar leaks on success",
         function() {
             var x = {};
             atomize.atomically(function() {
                 x.y = "hello";
             }, function () {
                 strictEqual(x.y, "hello", "Expecting to find 'hello'...");
             });
         });


    test("Modification of non-TVar leaks on failure",
         function() {
             var x = {};
             try {
                 atomize.atomically(function() {
                     // x is not a TVar, so this write isn't protected
                     // by the txn
                     x.y = "hello";
                     throw niceException;
                     x.z = "goodbye";
                 });
             } catch (e) {
                 strictEqual(e, niceException, "Should have caught niceException");
                 strictEqual(x.y, "hello", "Expecting to find 'hello'");
                 strictEqual(x.z, undefined, "Expecting to find undefined");
             }
         });

    test("Can create fresh TVar of empty object and return it",
         function () {
             atomize.atomically(function () {
                 return atomize.lift({});
             }, function (x) {
                 notStrictEqual(x, undefined, "Should have got an object back");
                 deepEqual(x, {}, "Object should be an empty object");
                 deepEqual(x, atomize.lift({}),
                           "Object should be an empty object (lifted)");
             });
         });

    test("Can create fresh TVar of non-empty object and return it",
         function () {
             atomize.atomically(function () {
                 return atomize.lift({a: "hello", b: {}});
             }, function (x) {
                 notStrictEqual(x, undefined, "Should have got an object back");
                 deepEqual(x, {a: "hello", b: {}}, "Object should be populated");
                 deepEqual(x, atomize.lift({a: "hello", b: {}}),
                           "Object should be populated (lifted)");
             });
         });

    test("Can create TVar from existing object and modify it",
         function () {
             var x = {a: "hello"};
             atomize.atomically(function () {
                 var y = atomize.lift(x);
                 y.a = "goodbye";
                 y.b = atomize.lift({});
                 deepEqual(y, atomize.lift({a: "goodbye", b: {}}),
                           "In txn modifications should work");
             }, function () {
                 deepEqual(x, {a: "goodbye", b: {}}, "Object should have been modified");
                 deepEqual(x, atomize.lift({a: "goodbye", b: {}}),
                           "Object should have been modified (lifted)");
                 x.b = 5; // sadly, can't be prevented
             });
         });

    test("Can only write to TVar when in Txn",
         function () {
             atomize.atomically(function () {
                 var y = atomize.lift({});
                 y.a = "hello";
                 return y;
             }, function (x) {
                 deepEqual(x, {a: "hello"}, "Got the wrong object back");
                 deepEqual(x, atomize.lift({a: "hello"}), "Got the wrong object back (lifted)");
                 try {
                     x.a = "goodbye";
                 } catch (e) {
                     strictEqual(e.constructor, WriteOutsideTransactionException,
                                 "Should have caught a write-violation exception");
                 }
                 try {
                     delete x.a;
                 } catch (e) {
                     strictEqual(e.constructor, DeleteOutsideTransactionException,
                                 "Should have caught a delete-violation exception");
                 }
             });
         });

    test("Can only only assign TVars and primitives to TVars",
         function () {
             atomize.atomically(function () {
                 var x = atomize.lift({});
                 x.a = "hello";
                 x.b = 5;
                 x.c = true;
                 x.d = atomize.lift({});
                 deepEqual(x, atomize.lift({a: "hello", b: 5, c: true, d: {}}),
                           "Object creation and population failed");
                 try {
                     x.e = {}
                 } catch (e) {
                     strictEqual(e.constructor, NotATVarException,
                                 "Should have caught a not-a-tvar exception")
                 }
             });
         });

    test("Can modify existing TVars",
         function () {
             atomize.atomically(function () {
                 var y = atomize.lift({});
                 y.a = "hello";
                 y.b = atomize.lift({x: 5, y: true, z: {}});
                 deepEqual(y, atomize.lift({a: "hello", b: {x: 5, y: true, z: {}}}),
                           "Object creation and population failed");
                 return y;
             }, function (x) {
                 deepEqual(x, {a: "hello", b: {x: 5, y: true, z: {}}},
                           "Got the wrong object back");
                 deepEqual(x, atomize.lift({a: "hello", b: {x: 5, y: true, z: {}}}),
                           "Got the wrong object back (lifted)");
                 atomize.atomically(function () {
                     x.a = "goodbye";
                     x.b.y = false;
                     delete x.b.z;
                     deepEqual(x, atomize.lift({a: "goodbye", b: {x: 5, y: false}}),
                               "Modifications not visible within txn");
                 }, function () {
                     deepEqual(x, {a: "goodbye", b: {x: 5, y: false}},
                               "Got the wrong object back post modifications");
                     deepEqual(x, atomize.lift({a: "goodbye", b: {x: 5, y: false}}),
                               "Got the wrong object back post modifications (lifted)");
                 });
             });
         });

    test("Writes to TVars within Txn are undone on abort",
         function () {
             atomize.atomically(function () {
                 var y = atomize.lift({});
                 y.a = "hello";
                 y.b = atomize.lift({x: 5, y: true, z: {}});
                 return y;
             }, function (x) {
                 deepEqual(x, {a: "hello", b: {x: 5, y: true, z: {}}},
                           "Got the wrong object back");
                 deepEqual(x, atomize.lift({a: "hello", b: {x: 5, y: true, z: {}}}),
                           "Got the wrong object back (lifted)");

                 try {
                     atomize.atomically(function () {
                         x.a = "goodbye";
                         x.b.y = false;
                         delete x.b.z;
                         x.b.w = atomize.lift({});
                         deepEqual(x, atomize.lift({a: "goodbye", b: {x: 5, y: false, w: {}}}),
                                   "Modifications not visible within txn");
                         throw niceException;
                     });
                 } catch (e) {
                     strictEqual(e, niceException, "Should have caught niceException");
                 }
                 deepEqual(x, {a: "hello", b: {x: 5, y: true, z: {}}},
                           "Modifications not undone on Txn abort");
                 deepEqual(x, atomize.lift({a: "hello", b: {x: 5, y: true, z: {}}}),
                           "Modifications not undone on Txn abort (lifted)");
                 atomize.atomically(function () {
                     deepEqual(x, atomize.lift({a: "hello", b: {x: 5, y: true, z: {}}}),
                               "Undone modifications may have leaked");
                 });
             });
         });

    test("Writes to TVars within Txn are undone on abort for existing var",
         function () {
             var x = {a: "hello", b: {x: 5, y: true, z: {}}};
             atomize.atomically(function () {
                 var y = atomize.lift(x);
                 y.b.x = 6;
             }, function () {
                 deepEqual(x, {a: "hello", b: {x: 6, y: true, z: {}}},
                           "Object modifications lost");
                 deepEqual(x, atomize.lift({a: "hello", b: {x: 6, y: true, z: {}}}),
                           "Object modifications lost (lifted)");
                 try {
                     atomize.atomically(function () {
                         var y = atomize.lift(x);
                         y.a = "goodbye";
                         y.b.y = false;
                         delete y.b.z;
                         y.b.w = atomize.lift({});
                         deepEqual(y, atomize.lift({a: "goodbye", b: {x: 6, y: false, w: {}}}),
                                   "Modifications not visible within txn");
                         throw niceException;
                     });
                 } catch (e) {
                     strictEqual(e, niceException, "Should have caught niceException");
                 }
                 deepEqual(x, {a: "hello", b: {x: 6, y: true, z: {}}},
                           "Modifications not undone on Txn abort");
                 deepEqual(x, atomize.lift({a: "hello", b: {x: 6, y: true, z: {}}}),
                           "Modifications not undone on Txn abort (lifted)");
                 atomize.atomically(function () {
                     deepEqual(x, atomize.lift({a: "hello", b: {x: 6, y: true, z: {}}}),
                               "Undone modifications may have leaked");
                 });
             });
         });

});