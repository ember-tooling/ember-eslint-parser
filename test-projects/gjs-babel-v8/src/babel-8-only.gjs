/**
 * The Babel 8 parser rejects the old `assert` form of
 * import attributes. Its error text shows that Babel ran.
 */
import data from './data.json' assert { type: 'json' };

export default <template>{{data.name}}</template>;
