function createValidator(field) {
    field = normalize(field);

    if (field.required) {
        return requiredValidator(field);
    }

    switch (field.type) {
        case 'bool':
        case 'boolean':
        case Boolean:
            return booleanValidator(field);

        case 'int':
        case 'integer':
            field.int = true;
            return numberValidator(field);

        case Number:
        case 'num':
        case 'number':
            return numberValidator(field);

        case String:
        case 'str':
        case 'string':
            return stringValidator(field);

        case Array:
        case 'arr':
        case 'array':
            return arrayValidator(field);

        case Object:
        case 'obj':
        case 'object':
            return objectValidator(field);

        case 'any':
            return anyValidator(field);

        default:
            throw `Unsupported Type '${field.type}.'`;
    }
}

function normalize(field) {
    let name = field.name;

    if (typeof field === 'function') {
        return { type: field, name };
    }

    if (typeof field === 'string') {
        if (field.slice(-9) === '-required') {
            return { type: field, name, required: true }
        }

        return { type: field, name };
    }

    if (!Array.isArray(field)) return field;

    let [ type, required, sub ] = field;
    switch (type) {
        case Object:
        case 'obj':
        case 'object':
            return { type, required, name, fields: sub };

        case Array:
        case 'arr':
        case 'array':
            return { type, required, name, items: sub };
    }

    return { type, required, name };
}

function isNone(value) {
    return value === undefined || value === null;
}

function error(value, field, defaultMessage) {
    if (!field.message) throw defaultMessage;

    if (typeof field.message === 'function')
        throw field.message.call(null, value);

    throw field.message;
}

function stringValidator(field) {
    return value => {
        if (isNone(value)) return;

        value = String(value);

        if (field.minLength && value.length < field.minLength) {
            error(value, field, `${field.name} must be at least ${field.minLength} characters.`);
        }

        if (field.maxLength && value.length > field.maxLength) {
            error(value, field, `${field.name} must be ${field.maxLength} characters or less.`);
        }

        if (field.value && value !== field.value) {
            error(value, field, `${field.name} must be ${field.maxValue}.`);
        }

        if (field.regex && !field.regex.test(value)) {
            error(value, field, `Invalid ${field.name} format.`);
        }

        return value;
    }
}

function numberValidator(field) {
    let parse;
    if (field.int) parse = parseInt;
    else parse = parseFloat;

    return value => {
        if (isNone(value)) return;

        value = parse(value);

        if (isNaN(value)) {
            error(value, field, `${field.name} is not a number.`);
        }

        if (field.minValue && value < field.minValue) {
            error(value, field, `${field.name} must be at least ${field.minValue}.`);
        }

        if (field.maxValue && value < field.maxValue) {
            error(value, field, `${field.name} must be ${field.maxValue} or less.`);
        }

        if (field.value && value !== field.value) {
            error(value, field, `${field.name} must be ${field.maxValue}.`);
        }

        return value;
    };
}

function arrayValidator(field) {
    let itemValidator;

    if (field.items) {
        field.items.name = `${field.name}.<item>`;
        itemValidator = createValidator(field.items);
    }
    else {
        itemValidator = anyValidator;
    }

    return value => {
        if (isNone(value)) return;

        if (!Array.isArray(value)) {
            error(value, field, `${field.name} is not a array.`);
        }

        if (field.minItems && value.length < field.minItems) {
            error(value, field, `${field.name} must have at least ${field.minItems} items.`);
        }

        if (field.maxItems && value.length > field.maxItems) {
            error(value, field, `${field.name} must have ${field.maxItems} items or less.`);
        }

        return value.map(itemValidator);
    }
}

function objectValidator(field) {
    let validator = {};
    let fields = field.fields;

    for (let name in fields) {
        if (!fields.hasOwnProperty(name)) continue;
        fields[name].name = `${field.name}.${name}`;

        validator[name] = createValidator(fields[name]);
    }

    return value => {
        if (isNone(value)) return;

        if (value.constructor !== Object) {
            error(value, field, `${field.name} is invalid format.`);
        }

        let result = {};

        for (let field in validator) {
            result[field] = validator[field].call(null, value[field]);
        }

        return result;
    }
}

function booleanValidator(field) {
    return value => {
        if (isNone(value)) return;

        value = Boolean(value);

        if (field.value && value !== field.value) {
            error(value, field, `${field.name} must be ${field.value}.`);
        }

        return value;
    }
}

function anyValidator() {
    return value => value;
}

function requiredValidator(field) {
    field.required = false;

    let validator = createValidator(field);

    return value => {
        if (value === undefined || value === null) {
            error(value, field, `${field.name} is required.`);
        }

        return validator(value);
    };
}

function validate(fields) {
    let validator = {};

    for (let field in fields) {
        if (!fields.hasOwnProperty(field)) continue;

        validator[field] = createValidator({
            type: 'object',
            required: true,
            fields: fields[field],
            name: field
        });
    }

    return (req, res, next) => {
        try {
            for (let field in validator) {

                if (!fields.hasOwnProperty(field)) continue;
                req[field] = validator[field].call(null, req[field]);
            }

            next();
        } catch (e) {
            next(e);
        }
    };
}

module.exports = validate;
