const spawner = require('spawner');
const sourcesRunner = require('runner.sources');
const spawnerRunner = require('runner.spawner');
const linkRunner = require('runner.link');
const transporterRunner = require('runner.transporter');
const upgraderRunner = require('runner.upgrader');
const workerRunner = require('runner.worker');
const energyProvider = require('provider.energy');


module.exports.loop = function () {

    const hostileCreeps = Game.spawns['Spawn1'].room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps != null && hostileCreeps.length > 0) {
        Game.notify(hostileCreeps.length + ' Hostile creeps in your room!', 5);
    }


    spawnerRunner.init();
    upgraderRunner.init();
    sourcesRunner.init();
    try {
        energyProvider.init();
    } catch (err) {
        console.log(err.message + '\n' + err.stack);
    }
    linkRunner.init();
    transporterRunner.init();
    workerRunner.init();
    spawner.run();
    linkRunner.run();
    sourcesRunner.run();
    upgraderRunner.run();
    workerRunner.run();
    transporterRunner.run();

    for (let name in Game.creeps) {
        if (!Game.creeps.hasOwnProperty(name)) continue;
        const creep = Game.creeps[name];
        if (creep.memory.role == 'conqueror') {
            if (Game.rooms['E69S2'] == null || creep.reserveController(Game.rooms['E69S2'].controller) ) {
                creep.moveTo(Game.flags['conq']);
                creep.say('conq');
            }
        }
    }

    for (const spawnName in Game.spawns) {
        if (!Game.spawns.hasOwnProperty(spawnName)) continue;
        const towers = Game.spawns[spawnName].room.find(FIND_MY_STRUCTURES, {filter: struct => struct.structureType == STRUCTURE_TOWER});
        for (let towerId in towers) {
            if (!towers.hasOwnProperty(towerId)) continue;
            const tower = towers[towerId];
            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            const closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {filter: creep => creep.hits < creep.hitsMax});
            const damagedStructures = Game.rooms[tower.pos.roomName].find(FIND_STRUCTURES, {filter: structure => structure.hits < structure.hitsMax * 0.5}).sort((a, b) => {
                const aRatio = a.hits / a.hitsMax;
                const bRatio = b.hits / b.hitsMax;
                return aRatio - bRatio;
            });
            if (closestHostile) {
                tower.attack(closestHostile);
            } else if (closestDamagedCreep) {
                tower.heal(closestDamagedCreep);
            } else if (damagedStructures.filter(struct => struct != null)[0] && Game.getObjectById('583bab3c98da8b696d5c7cb9').store.energy >= 1000) {
                tower.repair(damagedStructures.filter(struct => struct != null)[0]);
            }
        }
    }

    spawnerRunner.run();

};