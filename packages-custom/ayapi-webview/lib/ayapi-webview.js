'use babel';
import { CompositeDisposable } from 'atom';

export default class AyapiWebview {
  constructor(state) {
    let dummy = (new Date()).toString();
    let defaults = {
      address: 'about:blank'
    };
    this.uri = state.uri;
    this.address = state.address || defaults.address;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'AyapiWebview',
      title: this.title,
      uri: this.uri,
      address: this.address
    };
  }
  
  static deserialize(state) {
    return new AyapiWebview(state);
  }

  // Tear down any state and detach
  destroy() {
    // console.log('destroy model');
  }

  // getElement() {
  //   return this.element;
  // }

}

atom.deserializers.add(AyapiWebview);
