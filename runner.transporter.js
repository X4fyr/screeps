/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('runner.transporter');
 * mod.thing == 'a thing'; // true
 */
const spawnerRunner = require('runner.spawner');
const energyProvider = require('provider.energy');
const util = require('utility');

let memory = {
    /**
     *  @type {Array<Object>}
     */
    tasks: [
        /**
         *  @type {{sink: String, source: String, creeps: String[], uuid: String, priority: Number}}
         */
        {
            sink: "",
            source: "",
            creeps: [],
            uuid: ""
        }]
};

const creepRunner = function () {
    for (let taskId in memory.tasks) {
        if (!memory.tasks.hasOwnProperty(taskId)) continue;
        const task = memory.tasks[taskId];
        for (let idx in memory.tasks[taskId].creeps) {
            if (!memory.tasks[taskId].creeps.hasOwnProperty(idx)) continue;
            /** @type {Creep} */ const creep = Game.getObjectById(task.creeps[idx]);
            const source = Game.getObjectById(task.source);
            const sink = Game.getObjectById(task.sink);
            if (creep && source && sink) {
                if (creep.carry.energy == 0) {
                    let result;
                    if (source instanceof StructureContainer || source instanceof StructureStorage) {
                        result = energyProvider.getUnreserved(creep, source);
                    } else {
                        result = creep.withdraw(source, RESOURCE_ENERGY);
                    }
                    if (result == ERR_NOT_IN_RANGE || result == ERR_NOT_ENOUGH_RESOURCES) {
                        creep.moveTo(source);
                    } else if (result == OK && creep.transfer(sink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sink);
                    }
                } else {
                    if (creep.transfer(sink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sink);
                    }
                }
            }
        }
    }
};
const assignCreeps = function () {
    const creeps = Game.creeps;
    for (let idx in creeps) {
        if (!creeps.hasOwnProperty(idx)) continue;
        if (creeps[idx].memory.role == 'transporter' && creeps[idx].memory.unassigned == true) {
            const creep = creeps[idx];
            delete creep.memory.unassigned;
            for (let idx in memory.tasks) {
                if (!memory.tasks.hasOwnProperty(idx)) continue;
                if (memory.tasks[idx].uuid == creep.memory.task) {
                    memory.tasks[idx].creeps.push(creep.id);
                }
            }
        }

    }
};

/**
 * Spawn missing creeps in the room, where the source resides
 */
const missingCreepsRunner = function () {
    for (let idx in memory.tasks) {
        if (!memory.tasks.hasOwnProperty(idx)) continue;
        const task = memory.tasks[idx];
        /**@type {RoomObject}*/let source = Game.getObjectById(task.source);
        /**@type {RoomObject}*/let sink = Game.getObjectById(task.sink);
        if (!source || !sink) {
            console.log('Invalid transporter task: ' + idx);
        } else {
            if (!task.uuid) {
                memory.tasks[idx].uuid = task.uuid = util.getRandomUUID();
            }
            if (!task.creeps) {
                memory.tasks[idx].creeps = task.creeps = [];
            }
            if (!task.priority) {
                memory.tasks[idx].priority = task.priority = 2;
            }
            const range = source.pos.getRangeTo(sink);
            memory.tasks[idx].creeps = task.creeps = task.creeps.filter(creepId => Game.getObjectById(creepId));
            if (task.creeps.length < 1) {
                if (range <= 1) {
                    //spawnerRunner.registerMissingCreep('transporter', [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                    // CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE], {
                    //    task: task.uuid,
                    //    unassigned: true
                    //}, source.pos.roomName, task.priority);
                    spawnerRunner.registerMissingCreepRatio('transporter', [{part: CARRY, ratio: 1}], 0, 850,
                        {task: task.uuid, unassigned: true}, source.pos.roomName, task.priority);
                } else {
                    spawnerRunner.registerMissingCreep('transporter', [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], {
                        task: task.uuid,
                        unassigned: true
                    }, source.pos.roomName, task.priority);
                }
            }
        }
    }
};
const publicExport = {
    init: function () {
        memory = Memory.runner.transporter;
        missingCreepsRunner();
        assignCreeps();
    },
    run: function () {
        creepRunner();
        Memory.runner.transporter = memory;
    }
};


module.exports = publicExport;