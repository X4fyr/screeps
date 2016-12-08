const spawnerRunner = require('runner.spawner');
const upgraderRunner = require('runner.upgrader');
const energyProvider = require('provider.energy');

/**@constant*/
const BUILDER_TARGET = 6;

/**@constant*/
const ROLE_NAME = 'worker';

/**@constant*/
const FILL = 'fill';

/**@constant*/
const REPAIR = 'repair';

/**@constant*/
const BUILD = 'build';

/**@constant*/
const UPGRADE = 'upgrade';

/**
 * @type {{rooms:string[]}}
 */
let memory = {};

/**
 * @typedef {{roomName: string, creeps:Creep[], targets:Array<{target: Array<RoomObject>, task: string}>}} RoomTask
 * @type {{rooms:RoomTask[]}}
 */
const local = {};

const workerRunner = {
    init: function() {
        memory = Memory.runner.worker;
        local.rooms = [];
        for (let roomName of memory.rooms) {
            let idx = local.rooms.push({roomName: roomName, creeps: [], targets: []}) - 1;
            for (let creepName in Game.creeps) {
                if (Game.creeps.hasOwnProperty(creepName)) {
                    const creep = Game.creeps[creepName];
                    if (creep.memory.role == "worker" && creep.memory.roomName == roomName) {
                        local.rooms[idx].creeps.push(creep);
                    }
                }
            }
        }
    },
    run: function() {
        try {
            missingCreepsRunner();
            collectTargets();
            creepRunner();
        } catch (err) {
            console.log(err.message + '\n' + err.stack);
        }
    },
    /**
     * @param {String} roomName
     * @return {?Number} health state between 1-4. Greater is better. null if room not known
     */
    healthState(roomName) {
        if (!local.rooms.hasOwnProperty(roomName)) return null;
        /**@type {RoomTask}*/ const roomTask = local.rooms[roomName];
        if (roomTask.creeps.length < BUILDER_TARGET / 3) return 1;
        else if (roomTask.creeps.length < BUILDER_TARGET * 2 / 3) return 2;
        else if (roomTask.creeps.length < BUILDER_TARGET) return 3;
        else return 4;

    }
};
let creepRunner = function () {
    for (let roomTask of local.rooms) {
        for (let creep of roomTask.creeps) {
            if (creep.carry.energy == 0 && !creep.memory.refilling) {
                creep.memory.refilling = true;
                creep.say('refilling');
            }
            if (creep.memory.refilling) {
                const result = energyProvider.refill(creep);
                if (result == null) {
                    creep.say('nfs');
                    creep.moveTo(creep.room.find(FIND_MY_SPAWNS)[0]);
                    continue;
                }
                creep.memory.refilling = result;
            }
            if (!creep.memory.refilling) {
                if (roomTask.targets.length == 0) {
                    creep.say("ntd");
                    continue;
                }
                const targetGroup = roomTask.targets[0];
                const target = creep.pos.findClosestByRange(targetGroup.target);
                let result;
                switch (targetGroup.task) {
                    case FILL:
                        result = creep.transfer(target, RESOURCE_ENERGY);
                        break;
                    case REPAIR:
                        result = creep.repair(target);
                        break;
                    case BUILD:
                        result = creep.build(target);
                        break;
                    case UPGRADE:
                        result = creep.upgradeController(target);
                        break;
                }
                if (result == ERR_NOT_IN_RANGE || creep.pos.roomName != creep.memory.roomName) {
                    creep.moveTo(target);
                } else if (result != OK && result != ERR_BUSY) {
                    creep.say(result);
                    console.log('Error working: ' + target + '\t' + targetGroup.task + '\t' + result);
                }
            }
        }
    }
};

let collectTargets = function () {
    for (let roomTask of local.rooms) {
        roomTask.targets = [];
        /**@type {Room}*/const room = Game.rooms[roomTask.roomName];
        if (room.controller.ticksToDowngrade < 4000) {
            roomTask.targets.push({
                target: [room.controller],
                task: UPGRADE
            });
        }
        if (spawnerRunner.queueState(roomTask.roomName, 4) != 0 || spawnerRunner.queueState(roomTask.roomName, 3) != 0) {
            roomTask.targets.push({
                target: room.find(FIND_MY_STRUCTURES, {filter: it => (it.structureType == STRUCTURE_EXTENSION || it.structureType == STRUCTURE_SPAWN) && it.energy < it.energyCapacity}),
                task: FILL
            });
        }
        roomTask.targets.push({
            target: room.find(FIND_STRUCTURES, {filter: it => it.hits < it.hitsMax * 0.5 && it.structureType != STRUCTURE_WALL && it.structureType != STRUCTURE_RAMPART}),
            task: REPAIR
        });
        roomTask.targets.push({
            target: room.find(FIND_MY_CONSTRUCTION_SITES),
            task: BUILD
        });
        roomTask.targets.push({
            target: room.find(FIND_MY_STRUCTURES, {filter: it => (it.structureType == STRUCTURE_EXTENSION || it.structureType == STRUCTURE_SPAWN) && it.energy < it.energyCapacity}),
            task: FILL
        });
        if (upgraderRunner.healthState(roomTask.roomName) < 3) {
            roomTask.targets.push({
                target: [room.controller],
                task: UPGRADE
            });
        }
        for (let idx in roomTask.targets) {
            if (roomTask.targets.hasOwnProperty(idx)) {
                let targetGroup = roomTask.targets[idx];
                targetGroup.target.filter(it => it != null);
                if (targetGroup.target.length == 0) {
                    roomTask.targets[idx] = null;
                }
            }
        }
        roomTask.targets = roomTask.targets.filter(it => it != null);
    }
};

let missingCreepsRunner = function () {
    for (let roomTask of local.rooms) {
        if (roomTask.creeps.length < BUILDER_TARGET / 3) {
            spawnerRunner.registerMissingCreep(ROLE_NAME, [WORK, WORK, CARRY, MOVE], {roomName: roomTask.roomName}, roomTask.roomName, 4);
        } else if (roomTask.creeps.length < BUILDER_TARGET * 2 / 3) {
            spawnerRunner.registerMissingCreep(ROLE_NAME, [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], {roomName: roomTask.roomName}, roomTask.roomName, 3);
        } else if (roomTask.creeps.length < BUILDER_TARGET) {
            spawnerRunner.registerMissingCreep(ROLE_NAME, [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], {roomName: roomTask.roomName}, roomTask.roomName, 2);
        }
    }
};

module.exports = workerRunner;