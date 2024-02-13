import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import { Await } from './await.gts';


export { Await };

export class AppComponent extends Component {
    @tracked x: number = 1;
}