import {Products, ProductAttributes} from './collection';

Products.addLinks({
    attributes: {
        collection: ProductAttributes,
        inversedBy: 'products',
    },
});

ProductAttributes.addLinks({
    products: {
        type: 'many',
        collection: Products,
        field: 'productId',
        foreignIdentityField: 'productId',
    },
});
