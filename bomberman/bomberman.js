// atomize-translate bomberman.js bomberman-compat.js atomize Bomberman Player Cell Bomb this

var atomize,
    bomberman,
    canvas,
    ctx,
    clientWidth = 0,
    clientHeight = 0;

function Cell(bomberman, x, y, raw) {
    var self = this;
    this.bomberman = bomberman;
    this.x = x;
    this.y = y;
    this.raw = raw;
    this.clearCount = 0;
    if (x === 0 || x + 1 === bomberman.width ||
        y === 0 || y + 1 === bomberman.height ||
        (x % 2 === 0 && y % 2 === 0)) {
        this.wall = true;
    }
    atomize.atomically(function () {
        if (undefined === self.raw.wall) {
            self.raw.wall = self.wall;
            self.raw.fatal = self.fatal;
        }
    });
}

Cell.prototype = {
    watching: false,
    wall: false,
    fatal: false,
    fatalTimer: 1000,

    setFatal: function () {
        var self, occupant, fun, bomb;
        self = this;
        atomize.atomically(function () {
            self.raw.fatal = true;
            occupant = self.raw.occupant;
            delete self.raw.occupant;
            return occupant;
        }, function (occupant) {
            fun = function () { self.clearFatal(); };
            setTimeout(fun, self.fatalTimer);
            self.clearCount += 1;
            if (undefined !== occupant && "bomb" === occupant.type && undefined !== occupant.id) {
                bomb = self.bomberman.bombs[occupant.id];
                if (undefined != bomb) {
                    bomb.explode();
                }
            }
        });
    },

    clearFatal: function () {
        var self = this;
        self.clearCount -= 1;
        if (self.clearCount === 0) {
            atomize.atomically(function () {
                self.raw.fatal = false;
            });
        }
    },

    render: function (ctx, scale) {
        var offset;
        if (this.wall) {
            ctx.beginPath();
            ctx.fillStyle="#000000";
            ctx.fillRect(this.x*scale, this.y*scale, scale, scale);
            ctx.closePath();
        } else if (this.fatal) {
            offset = scale*0.05;
            ctx.beginPath();
            ctx.fillStyle="#E00000";
            ctx.fillRect(offset + this.x*scale, offset + this.y*scale, scale*0.9, scale*0.9);
            ctx.closePath();
        }
    },

    occupied: function () {
        return this.wall || undefined !== this.occupant;
    },

    placeBomb: function (bomb, cont) {
        var self = this;
        atomize.atomically(function () {
            if (undefined === self.raw.occupant ||
                "player" === self.raw.occupant.type) {
                self.raw.occupant = bomb.raw;
                return true;
            } else {
                return false;
            }
        }, cont);
    },

    occupy: function (player, cont) {
        var self = this;
        if (self.wall) {
            cont(false);
        } else {
            atomize.atomically(function () {
                if (self.raw.fatal) {
                    return false;
                } else if (undefined === self.raw.occupant) {
                    self.raw.occupant = player.raw;
                    return true;
                } else {
                    return false;
                }
            }, cont);
        }
    },

    unoccupy: function (player) {
        var self = this;
        atomize.atomically(function () {
            if (self.raw.occupant === player.raw) {
                delete self.raw.occupant;
            }
        });
    },

    watch: function () {
        var self, fun;
        if (this.wall || this.watching) {
            return;
        }
        this.watching = true;
        self = this;
        fun = function (props) {
            atomize.atomically(function () {
                if (props.occupant === self.raw.occupant &&
                    props.fatal === self.raw.fatal) {
                    atomize.retry();
                } else {
                    return {occupant: self.raw.occupant,
                            fatal: self.raw.fatal};
                }
            }, function (props) {
                if (undefined === props.occupant) {
                    delete self.occupant;
                } else {
                    self.occupant = props.occupant;
                }
                self.fatal = props.fatal;
                fun({occupant: self.occupant, fatal: self.fatal});
            })
        };
        fun({occupant: self.occupant, fatal: self.fatal});
    }
};

function Bomb(bomberman, raw) {
    this.bomberman = bomberman;
    this.x = -1;
    this.y = -1;
    this.raw = raw;
}

Bomb.prototype = {
    exploded: false,
    timer: 1500,

    startTimer: function () {
        var self, explode;
        self = this;
        explode = function () {
            self.explode();
        }
        setTimeout(explode, self.timer);
    },

    explode: function () {
        var self, exploded, i, cells;
        self = this;
        atomize.atomically(function () {
            var alreadyExploded = self.raw.exploded;
            self.raw.exploded = true;
            return alreadyExploded;
        }, function (alreadyExploded) {
            self.exploded = true;
            self.bomberman.deleteBomb(self);
            if (alreadyExploded) {
                return;
            }
            cells = [self.bomberman.grid[self.x][self.y]];

            if (! self.bomberman.grid[self.x][self.y - 1].wall) {
                cells.push(self.bomberman.grid[self.x][self.y - 1]);
                if (undefined !== self.bomberman.grid[self.x][self.y - 2] &&
                    ! self.bomberman.grid[self.x][self.y - 2].wall) {
                    cells.push(self.bomberman.grid[self.x][self.y - 2]);
                }
            }
            if (! self.bomberman.grid[self.x][self.y + 1].wall) {
                cells.push(self.bomberman.grid[self.x][self.y + 1]);
                if (undefined !== self.bomberman.grid[self.x][self.y + 2] &&
                    ! self.bomberman.grid[self.x][self.y + 2].wall) {
                    cells.push(self.bomberman.grid[self.x][self.y + 2]);
                }
            }

            if (! self.bomberman.grid[self.x - 1][self.y].wall) {
                cells.push(self.bomberman.grid[self.x - 1][self.y]);
                if (undefined !== self.bomberman.grid[self.x - 2] &&
                    ! self.bomberman.grid[self.x - 2][self.y].wall) {
                    cells.push(self.bomberman.grid[self.x - 2][self.y]);
                }
            }
            if (! self.bomberman.grid[self.x + 1][self.y].wall) {
                cells.push(self.bomberman.grid[self.x + 1][self.y]);
                if (undefined !== self.bomberman.grid[self.x + 2] &&
                    ! self.bomberman.grid[self.x + 2][self.y].wall) {
                    cells.push(self.bomberman.grid[self.x + 2][self.y]);
                }
            }

            for (i = 0; i < cells.length; i += 1) {
                cells[i].setFatal();
            }
        });
    },

    maybeInit: function () {
        var self = this;
        atomize.atomically(function () {
            return {x: self.raw.x, y: self.raw.y}
        }, function (pos) {
            self.x = pos.x;
            self.y = pos.y;
            atomize.atomically(function () {
                if (undefined === self.raw.id) {
                    atomize.retry();
                } else {
                    return self.raw.id;
                }
            }, function (id) {
                self.id = id;
            });
        });
    },

    render: function (ctx, scale) {
        x = (this.x + 0.5) * scale;
        y = (this.y + 0.5) * scale;
        ctx.beginPath();
        ctx.fillStyle="#A00000";
        ctx.arc(x,y,0.45*scale,0,Math.PI*2,true);
        ctx.closePath();
        ctx.fill();
    }
}

function Player(bomberman, raw) {
    this.bomberman = bomberman;
    this.raw = raw;
    this.x = -1;
    this.y = -1;
    this.xCell = -1;
    this.yCell = -1;
    this.bombs = [];
}

Player.prototype = {
    watching: false,
    ready: false,
    dead: false,
    respawnTime: 5000,
    blocked: false,

    north: function () {
        this.xv = 0;
        this.yv = -0.1;
    },

    south: function () {
        this.xv = 0;
        this.yv = 0.1;
    },

    east: function () {
        this.xv = 0.1;
        this.yv = 0;
    },

    west: function () {
        this.xv = -0.1;
        this.yv = 0;
    },

    dropBomb: function () {
        var bombs, i, bomb, fun, self;
        bombs = [];
        for (i = 0; i < this.bombs.length; i += 1) {
            if (! this.bombs[i].exploded) {
                bombs.push(this.bombs[i]);
            }
        }
        this.bombs = bombs;
        if (this.bombs.length > 4) {
            return;
        }
        bomb = new Bomb(this.bomberman, atomize.lift({type: "bomb",
                                                      x: this.xCell,
                                                      y: this.yCell,
                                                      exploded: false}));
        bomb.maybeInit();
        self = this;
        fun = function (success) {
            if (success) {
                bomb.startTimer();
                self.bombs.push(bomb);
            }
        },
        this.bomberman.dropBomb(this.xCell, this.yCell, bomb, fun);
    },

    render: function (ctx, scale) {
        var x, y;
        if (this.dead) {
            return;
        }
        x = this.x * scale;
        y = this.y * scale;
        ctx.beginPath();
        if (this === this.bomberman.me) {
            ctx.fillStyle="#00D0D0";
        } else {
            ctx.fillStyle="#00A000";
        }
        ctx.arc(x, y, 0.25*scale, 0, Math.PI*2, true);
        ctx.closePath();
        ctx.fill();
    },

    step: function () {
        var xNew, yNew, xCell, yCell, self, fun;
        if (this.blocked || this.dead || ! this.ready) {
            return;
        }
        this.blocked = true;
        self = this;
        xNew = this.x + this.xv;
        yNew = this.y + this.yv;
        xCell = Math.floor(xNew);
        yCell = Math.floor(yNew);
        if (this.bomberman.grid[this.xCell][this.yCell].fatal ||
            this.bomberman.grid[xCell][yCell].fatal) {
            atomize.atomically(function () {
                self.raw.dead = true;
                self.bomberman.unoccupy(self.xCell, self.yCell, self);
            }, function () {
                self.dead = true;
                self.blocked = false;
                fun = function () {
                    self.spawn();
                };
                setTimeout(fun, self.respawnTime);
            });
            return;
        }
        if (xCell !== this.xCell || yCell !== this.yCell) {
            if (this.bomberman.grid[xCell][yCell].occupied()) {
                this.blocked = false;
                return;
            } else {
                self = this;
                fun = function (success) {
                    if (success) {
                        self.bomberman.unoccupy(self.xCell, self.yCell, self);
                        self.xCell = xCell;
                        self.yCell = yCell;
                        self.x = xNew;
                        self.y = yNew;
                        atomize.atomically(function () {
                            self.raw.x = xNew;
                            self.raw.y = yNew;
                        }, function () {
                            self.blocked = false;
                        });
                    }
                }
                this.bomberman.occupy(xCell, yCell, self, fun);
            }
        } else {
            atomize.atomically(function () {
                self.raw.x = xNew;
                self.raw.y = yNew;
            }, function () {
                self.x = xNew;
                self.y = yNew;
                self.blocked = false;
            });
        }
    },

    watch: function () {
        var self, fun;
        if (this.watching) {
            return;
        }
        this.watching = true;
        self = this;
        fun = function () {
            atomize.atomically(function () {
                if (self.x === self.raw.x && self.y === self.raw.y && self.dead === self.raw.dead) {
                    atomize.retry();
                } else {
                    return {x: self.raw.x, y: self.raw.y, dead: self.raw.dead}
                }
            }, function (pos) {
                self.x = pos.x;
                self.y = pos.y
                self.dead = pos.dead;
                fun();
            });
        };
        fun();
    },

    spawn: function () {
        var self, fun, x, y, directions, keys;
        self = this;
        x = Math.round((self.bomberman.width - 1) * Math.random());
        y = Math.round((self.bomberman.height - 1) * Math.random());
        fun = function (success) {
            if (success) {
                atomize.atomically(function () {
                    self.raw.x = x + 0.5;
                    self.raw.y = y + 0.5;
                    self.raw.dead = false;
                }, function () {
                    self.x = x + 0.5;
                    self.y = y + 0.5;
                    self.xCell = x;
                    self.yCell = y;
                    self.ready = true;
                    self.dead = false;
                    directions = {north: function () { self.north() },
                                  south: function () { self.south() },
                                  east: function () { self.east() },
                                  west: function () { self.west() }};
                    if (self.bomberman.grid[x-1][y].wall) {
                        delete directions.west;
                    }
                    if (self.bomberman.grid[x+1][y].wall) {
                        delete directions.east;
                    }
                    if (self.bomberman.grid[x][y-1].wall) {
                        delete directions.north;
                    }
                    if (self.bomberman.grid[x][y+1].wall) {
                        delete directions.south;
                    }
                    keys = Object.keys(directions);
                    directions[keys[Math.round((keys.length - 1) * Math.random())]]();
                });
            } else {
                self.spawn();
            }
        };
        self.bomberman.occupy(x, y, self, fun);
    }
};

function Bomberman(raw) {
    this.raw = raw;
    this.grid = [];
    this.players = {};
    this.bombs = {};
}

Bomberman.prototype = {
    width: 25,
    height: 25,

    dropBomb: function (x, y, bomb, cont) {
        var self, fun;
        self = this;
        fun = function (success) {
            if (success) {
                atomize.atomically(function () {
                    self.raw.bombs.eventCount += 1;
                    self.raw.bombs.bombs[self.raw.bombs.eventCount] = bomb.raw;
                    bomb.raw.id = self.raw.bombs.eventCount;
                    return true;
                }, cont);
            } else {
                cont(false);
            }
        };
        self.grid[x][y].placeBomb(bomb, fun);
    },

    deleteBomb: function (bomb) {
        var self = this;
        atomize.atomically(function () {
            if (bomb.raw === self.raw.bombs.bombs[bomb.id]) {
                self.raw.bombs.eventCount += 1;
                delete self.raw.bombs.bombs[bomb.id];
            }
        });
    },

    occupy: function (x, y, player, cont) {
        this.grid[x][y].occupy(player, cont);
    },

    unoccupy: function (x, y, player) {
        this.grid[x][y].unoccupy(player);
    },

    watchGrid: function () {
        var x, y;
        for (x = 0; x < this.grid.length; x += 1) {
            for (y = 0; y < this.grid[x].length; y += 1) {
                this.grid[x][y].watch();
            }
        }
    },

    watchPlayers: function () {
        var fun, self, players, keys, i;
        self = this;
        fun = function (eventCount) {
            atomize.atomically(
                function () {
                    if (self.raw.players.eventCount === eventCount) {
                        atomize.retry();
                    } else {
                        players = {};
                        keys = Object.keys(self.raw.players.players);
                        for (i = 0; i < keys.length; i += 1) {
                            players[keys[i]] = self.raw.players.players[keys[i]];
                        }
                        return {players: players, eventCount: self.raw.players.eventCount};
                    }
                }, function (result) {
                    self.players = {};
                    keys = Object.keys(result.players);
                    for (i = 0; i < keys.length; i += 1) {
                        if (result.players[keys[i]] === self.me.raw) {
                            self.players[keys[i]] = self.me;
                        } else {
                            self.players[keys[i]] = new Player(self, result.players[keys[i]]);
                            self.players[keys[i]].watch();
                        }
                    }
                    fun(result.eventCount);
                });
        };
        fun(0);
    },

    watchBombs: function () {
        var fun, self, bombs, keys, i;
        self = this;
        fun = function (eventCount) {
            atomize.atomically(function () {
                if (self.raw.bombs.eventCount === eventCount) {
                    atomize.retry();
                } else {
                    bombs = {};
                    keys = Object.keys(self.raw.bombs.bombs);
                    for (i = 0; i < keys.length; i += 1) {
                        bombs[keys[i]] = self.raw.bombs.bombs[keys[i]];
                    }
                    return {bombs: bombs, eventCount: self.raw.bombs.eventCount};
                }
            }, function (result) {
                self.bombs = {};
                keys = Object.keys(result.bombs);
                for (i = 0; i < keys.length; i += 1) {
                    self.bombs[keys[i]] = new Bomb(self, result.bombs[keys[i]]);
                    self.bombs[keys[i]].maybeInit();

                }
                fun(result.eventCount);
            });
        };
        fun(0);
    },

    maybeInit: function () {
        var self, x, y, raw, cell;
        self = this;
        atomize.atomically(
            function () {
                if (undefined === self.raw.players) {
                    self.raw.players = atomize.lift({eventCount: 0, players: {}});
                }
                if (undefined === self.raw.bombs) {
                    self.raw.bombs = atomize.lift({eventCount: 0, bombs: {}});
                }
                if (undefined === self.raw.grid) {
                    self.raw.grid = atomize.lift([]);
                    for (x = 0; x < self.width; x += 1) {
                        self.raw.grid[x] = atomize.lift([]);
                        self.grid[x] = [];
                        for (y = 0; y < self.height; y += 1) {
                            raw = atomize.lift({});
                            self.raw.grid[x][y] = raw;
                            cell = new Cell(self, x, y, raw);
                            self.grid[x][y] = cell;
                        }
                    }
                } else {
                    self.width = self.raw.grid.length;
                    self.height = self.raw.grid[0].length;
                    for (x = 0; x < self.width; x += 1) {
                        self.grid[x] = [];
                        for (y = 0; y < self.height; y += 1) {
                            cell = new Cell(self, x, y, self.raw.grid[x][y]);
                            self.grid[x][y] = cell;
                        }
                    }
                }
                return atomize.lift({type: "player", dead: false});
            }, function (me) {
                self.watchGrid();
                self.watchPlayers();
                self.watchBombs();
                self.me = new Player(self, me);
                atomize.atomically(function () {
                    self.raw.players.eventCount += 1;
                    self.raw.players.players[self.raw.players.eventCount] = me;
                    self.me.raw.id = self.raw.players.eventCount;
                }, function () {
                    self.me.spawn();
                });
            });
    },

    render: function (ctx) {
        var minDim, maxDim, wallLen, x, y, keys;
        minDim = Math.min(clientWidth, clientHeight);
        maxDim = Math.max(this.width, this.height);
        wallLen = minDim / maxDim;

        for (x = 0; x < this.grid.length; x += 1) {
            for (y = 0; y < this.grid[x].length; y += 1) {
                this.grid[x][y].render(ctx, wallLen);
            }
        }

        keys = Object.keys(this.players);
        for (x = 0; x < keys.length; x += 1) {
            this.players[keys[x]].render(ctx, wallLen);
        }

        keys = Object.keys(this.bombs);
        for (x = 0; x < keys.length; x += 1) {
            this.bombs[keys[x]].render(ctx, wallLen);
        }
    }
};

function resizeCanvas() {
    var e;
    if (undefined !== canvas) {
        canvas.width = canvas.parentNode.offsetWidth;
        canvas.height = canvas.parentNode.offsetHeight;
        clientWidth = canvas.width;
        clientHeight = canvas.height;
        e = canvas.parentNode;
        while (undefined !== e && null !== e) {
            if (undefined !== e.clientHeight && undefined !== e.clientWidth &&
                e.clientHeight > 0 && e.clientWidth > 0) {
                clientHeight = Math.min(clientHeight, e.clientHeight);
                clientWidth = Math.min(clientWidth, e.clientWidth);
            }
            e = e.parentNode;
        }
        canvasLeft = 10;
        canvasTop = 10;
        e = canvas.parentNode;
        while (undefined !== e && null !== e) {
            if (undefined !== e.offsetLeft && undefined !== e.offsetTop) {
                canvasLeft += e.offsetLeft;
                canvasTop += e.offsetTop;
            }
            e = e.parentNode;
        }
    }
}

function initCanvas() {
    resizeCanvas();
    try {
        ctx = canvas.getContext("2d");
    } catch (e) {
    }
    if (!ctx) {
        alert("Could not initialise 2D canvas. Change browser?");
    }
}

function drawScene() {
    ctx.clearRect(0, 0, clientWidth, clientHeight);
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
    bomberman.render(ctx);
}

requestAnimFrame = (function () {
    return (this.requestAnimationFrame ||
            this.webkitRequestAnimationFrame ||
            this.mozRequestAnimationFrame ||
            this.oRequestAnimationFrame ||
            this.msRequestAnimationFrame ||
            function (/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
                setTimeout(callback, 1000 / 60);
            });
})();

function tick () {
    if (undefined !== bomberman && undefined !== bomberman.me) {
        bomberman.me.step();
    }
    drawScene();
    requestAnimFrame(tick);
}

function doKeyDown (event) {
    switch (event.keyCode) {
    case 38: // Up
        bomberman.me.north();
        break;
    case 40: // Down
        bomberman.me.south();
        break;
    case 37: // Left
        bomberman.me.west();
        break;
    case 39: // Right
        bomberman.me.east();
        break;
    case 32: // Space
        bomberman.me.dropBomb();
        break;
    }
}

function init () {
    atomize = new Atomize("http://localhost:9999/atomize");
    canvas = document.getElementById("game_canvas");
    initCanvas();

    atomize.onAuthenticated = function () {
        atomize.atomically(
            function () {
                if (undefined === atomize.root.bomberman) {
                    atomize.root.bomberman = atomize.lift({});
                }
                return atomize.root.bomberman;
            }, function (raw) {
                bomberman = new Bomberman(raw);
                bomberman.maybeInit();
                requestAnimFrame(tick);
                window.addEventListener('keydown', doKeyDown, true);
            });
    };
    atomize.connect();
}
