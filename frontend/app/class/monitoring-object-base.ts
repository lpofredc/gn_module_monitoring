import { Observable, of } from '@librairies/rxjs';
import { concatMap } from '@librairies/rxjs/operators';

import { MonitoringObjectService } from '../services/monitoring-object.service';
import { Utils } from '../utils/utils';

export class MonitoringObjectBase {
  modulePath: string;
  objectType: string;
  id: number; // id de l'objet

  cruved;

  idTableLocation;
  properties = {}; // liste des propriétés de type non géométrie
  geometry;

  resolvedProperties = {}; // liste des propriétés de type non géométrie résolues???

  medias; // children ?

  bIsInitialized = false;

  children = {};
  _children0 = {};
  parent: MonitoringObjectBase;
  myClass = MonitoringObjectBase;

  parentId;
  siteId;

  template = {};

  configParams = ['geometry_type', 'media_types'];
  config = {};

  protected _objService: MonitoringObjectService;

  constructor(
    modulePath: string,
    objectType: string,
    id,
    objService: MonitoringObjectService
  ) {
    if (!modulePath) {
      throw new Error('Monitoring object sans modulePath');
    }
    this.objectType = objectType;
    this.modulePath = modulePath;
    this.id = id;
    this._objService = objService;
  }

  monitoringObjectService() {
    return this._objService;
  }

  toString() {
    return `Object - ${this.modulePath} ${this.objectType} ${this.id}`;
  }

  initTemplate() {
    this.template['idTableLocation'] = this.configParam('id_table_location');
    this.template['label'] = this.configParam('label');
    this.template['label_list'] =
      this.configParam('label_list') || this.configParam('label') + 's';

    this.template['title'] = this.title();

    this.template['uuid'] = this.paramValue('uuid_field_name');
    this.template['description'] = this.paramValue(
      'description_field_name',
      true
    );

    this.template['fieldLabels'] = this.fieldLabels();
    this.template['fieldNames'] = this.fieldNames('display_properties');
    this.template['fieldNamesList'] = this.fieldNames('display_list');
  }

  setConfig() {
    for (const configParam of this.configParams) {
      this.config[configParam] = this.configParam(configParam);
    }
  }

  setData(data) {
    this.cruved = data.cruved;
    this.properties = data.properties;
    this.geometry = data.geometry;
    this.id = this.id || this.properties[this.configParam('id_field_name')];
    this.medias = data.medias;
    this.siteId = data.site_id;
    this.idTableLocation = data.id_table_location;


    // TODO verifier!!
    if (!this.parentId) {
        this.parentId = this.properties[this.parentIdFieldName()];
    } else {
        this.properties[this.parentIdFieldName()] = this.parentId;
    }
  }

  parentIdFieldName() {
    return !this.parentType()
      ? null
      : this._objService
        .configService()
        .configModuleObjectParam(
          'objects',
          this.modulePath,
          this.parentType(),
          'id_field_name'
        );
  }

  resolveProperty(elem): Observable<any> {
    let val = this.properties[elem.attribut_name];
    const configUtil = this._objService.configUtils(elem);

    if (elem.type_widget === 'date' || (elem.type_util === 'date' && val)) {
      val = Utils.formatDate(val);
    }

    if (val && configUtil && elem.type_widget) {
      return this._objService
        .dataUtilsService()
        .getUtil(elem.type_util, val, configUtil.fieldName);
    }
    return of(val);
  }

  resolveProperties(): Observable<any> {
    // return new Observable(observer => {
    const observables = {};

    for (const elem of this.schema()) {
      observables[elem.attribut_name] = this.resolveProperty(elem);
    }
    return Observable.forkJoin(observables).pipe(
      concatMap(
        resolvedProperties => {
          for (const key of Object.keys(resolvedProperties)) {
            this.resolvedProperties[key] = resolvedProperties[key];
          }
          return of(true);
        })
    );
  }

  configParam(fieldName) {
    return this._objService
      .configService()
      .configModuleObjectParam(
        'objects',
        this.modulePath,
        this.objectType,
        fieldName
      );
  }

  childrenTypes(configParam: string = null): Array<string> {
    let childrenTypes = this.configParam('children_types') || [];

    if (configParam) {
      childrenTypes = childrenTypes.filter(TypeChildren => {
        return this.child0(TypeChildren).config[configParam];
      });
    }
    return childrenTypes || [];
  }

  parentType() {
    return this.configParam('parent_type');
  }

  child0(childrenType) {
    if (this._children0[childrenType]) {
      return this._children0[childrenType];
    }
    const child0 = new this.myClass(
      this.modulePath,
      childrenType,
      null,
      this._objService
    );
    child0.setConfig();
    child0.initTemplate();
    this._children0[childrenType] = child0;
    return this._children0[childrenType];
  }

  childsLabel() {
    return Utils.mapArrayToDict(this.childrenTypes(), childrenType => {
      return this.child0(childrenType).configParam('label');
    });
  }

  paramValue(param, bResolved = false) {
    const fieldName = this.configParam(param);
    if (bResolved) {
      return fieldName && this.properties[fieldName];
    } else {
      return fieldName && this.resolvedProperties[fieldName];
    }
  }

  title() {
    const title = this.configParam('label');
    const description = this.paramValue('description_field_name', true);
    return description ? title + ' ' + description : title;
  }

  schema(typeSchema = 'all') {
    return this._objService
      .configService()
      .schema(this.modulePath, this.objectType, typeSchema);
  }

  schemaKeys(typeSchema = 'all') {
    return Object.keys(this.schema());
  }

  fieldNames(typeDisplay = '') {
    if (['display_properties', 'display_list'].includes(typeDisplay)) {
      return this.configParam(typeDisplay);
    }
    if (typeDisplay === 'schema') {
      return this.schema().map(elem => elem.attribut_name);
    }
  }

  /** return dict as {..., attribut_name: label, ...} */
  fieldLabels() {
    return Utils.mapArrayToDict(
      this.schema(),
      e => e.attribut_label,
      'attribut_name'
    );
  }

  geoFeature() {
    // patch
    this.resolvedProperties['object_type'] = this.objectType;
    this.resolvedProperties['description'] = this.paramValue(
      'description_field_name',
      true
    );

    return {
      id: this.id,
      object_type: this.objectType,
      type: 'Feature',
      geometry: this.geometry,
      properties: this.resolvedProperties
    };
  }

  isRoot() {
    return !this.parentType() && this.childrenTypes();
  }
}
