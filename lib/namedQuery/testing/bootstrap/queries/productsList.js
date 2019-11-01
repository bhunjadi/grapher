import { Products } from "../../../../query/testing/bootstrap/products/collection";

const productsList = Products.createQuery('productsList', {
    title: 1,
    price: 1,
    productId: 1,
    attributes: {
        unit: 1,
        delivery: 1,
    },
});

if (Meteor.isServer) {
    productsList.expose({
        firewall() {},
    });
}

export default productsList;
