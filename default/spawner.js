const spawnerRunner = require('runner.spawner');

const spawn = function (role, parts, priority) {
    spawnerRunner.registerMissingCreep(role, parts, {target: 0, roaming: true}, 'E68S3', priority);
};
const spawner = {
    run: function () {

        let harvesterTarget = 0;
        const upgraderTarget = 0;
        const builderTarget = 0;
        let flagBuilderTarget = 0;
        const conquerorTarget = 1;

        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role == "builder");
        const conquerors = _.filter(Game.creeps, creep => creep.memory.role == 'conqueror');
        const flagBuilders = _.filter(Game.creeps, creep => creep.memory.role == 'flagBuilder');

        if (Game.time % 10 == 0) {
            const harvesterDiff = harvesters.length - harvesterTarget;
            const upgraderDiff = upgraders.length - upgraderTarget;
            const builderDiff = builders.length - builderTarget;
            const conquerorDiff = conquerors.length - conquerorTarget;
            const flagBuilderDiff = flagBuilders.length - flagBuilderTarget;
            console.log('---');
            console.log('h\tu\tb\tc\tfb');
            console.log(harvesterDiff + '\t' + upgraderDiff + '\t' + builderDiff + '\t' + conquerorDiff + '\t' + flagBuilderDiff);
            if (Game.time % 100 == 0) {
                Game.notify((harvesterDiff + upgraderDiff + builderDiff + conquerorDiff + flagBuilderDiff).toString(), 180);
            }
        }
        if (flagBuilders.length < flagBuilderTarget) {
            spawn('flagBuilder', [WORK, CARRY, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE], 3);
        } else if (conquerors.length < conquerorTarget) {
            spawn('conqueror', [CLAIM, MOVE], 2);
        }
    }
};


module.exports = spawner;