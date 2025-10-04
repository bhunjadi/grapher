export default class FieldNode {
    constructor(name, body, isProjectionOperator = false) {
        this.name = name;
        this.projectionOperator = isProjectionOperator ? Object.keys(body)[0] : null;
        this.body = !(body !== null && typeof body === 'object' && !Array.isArray(body)) || isProjectionOperator ? body : 1;
        this.scheduledForDeletion = false;
    }

    applyFields(fields) {
        fields[this.name] = this.body;
    }
}
