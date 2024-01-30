import Service, { service } from '@ember/service';

export default class Example extends Service {
  @service router;

  get queryParams() {
    return this.router.currentRoute?.queryParams ?? {};
  }
}
