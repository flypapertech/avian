// Inbox Vue Component
import Vue from "vue/dist/vue"
import Vuetify from "vuetify"

Vue.use(Vuetify)

const Index = new Vue(
    {
        // el must be unique across components
        el: "#indexComponent",
        data: {
            objects: {},
            links: {}
        },
        created () {

            // Retrieve All Objects Example

            fetch("/index/config/objects.json")
            .then(response => response.json())
            .then(json => {
                this.objects = json.objects
            })

            // Retrieve Links Object

            fetch("/index/config/objects.json")
            .then(response => response.json())
            .then(json => {
                this.links = json.objects
            })
        }
    })
