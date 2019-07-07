import { createQuery } from 'meteor/cultofcoders:grapher';
import { Projects } from '../../../../query/testing/bootstrap/projects/collection';

const ALLOWED_BODY_LIMITED = {
  title: 1,
  author: {
    name: 1,
    comments: {
      text: 1,
    }
  },
}

const projectsListExposureSecurity = createQuery('projectsListExposureSecurity', {
    projects: {
        name: 1,
        private: 1,
        projectValue: 1,
        files: {
          filename: 1,
        }
    }
}, {
  scoped: true,
});

if (Meteor.isServer) {
  Meteor.methods({
    updateProjectToPrivate() {
      const res = Projects.update({name: 'Project 1'}, {$set: {private: true}});
    },

    updateProjectToPublic() {
      Projects.update({name: 'Project 1'}, {$set: {private: false}});
    }
  })

  projectsListExposureSecurity.expose({
        firewall(userId, params) {
        },
        embody: {
            $filter({filters, params}) {
                filters.title = params.title
            }
        },
        subscriptionFilter(type, doc, oldDoc, options) {
          const {node} = options;
          const path = [];
          let n = node;
          while (n) {
            if (n.linkName) {
              path.push(n.linkName);
            }
            n = n.parent;
          }

          // this is how to fetch full doc, not only changed fields when observe-changes triggers
          // if (type === 'observe-changes') {
          //   const collectionName = node.collection._name;
          //   const wholeDoc = options.publication._session.collectionViews.get(collectionName).documents.get(doc._id).getFields();
          // }

          const dottedPath = path.reverse().join('.');
          if (dottedPath === '') {
            if (doc.private) {
              doc = _.clone(doc);
              if (type === 'added') {
                delete doc.projectValue;
              }
              else if (type === 'observe-changes') {
                doc.projectValue = undefined;
              }
            }
          }
          return doc;
        }
    });
}

export default projectsListExposureSecurity;
