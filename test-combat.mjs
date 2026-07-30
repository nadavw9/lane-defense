import { CombatResolver } from './src/game/CombatResolver.js';
import { Lane } from './src/models/Lane.js';
import { Car } from './src/models/Car.js';

const lane = new Lane({id:0});
const car1 = new Car({ color: 'Red', hp: 5, speed: 5, row: 5 });
const car2 = new Car({ color: 'Red', hp: 5, speed: 5, row: 4 });
lane.addCar(car1);
lane.addCar(car2);

const shooter = { color: 'Red', damage: 5 };
const resolver = new CombatResolver();
const result = resolver.resolve(shooter, lane);

console.log('Result:', result);
console.log('Destroyed:', result.destroyed);
console.log('Cars remaining in lane:', lane.cars.length);
