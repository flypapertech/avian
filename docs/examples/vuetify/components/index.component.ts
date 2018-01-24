// Inbox Vue Component

const Index = new Vue(
    {
        el: "#component",
        data: {
            objects: {},
            links: {}
        },
        created () {

            // Retrieve All Objects Example

            fetch("/index/storage/objects.json")
            .then(response => response.json())
            .then(json => {
                this.objects = json.objects
            })

            // Retrieve Links Object

            fetch("/index/storage/objects.json")
            .then(response => response.json())
            .then(json => {
                this.links = json.objects
            })
        }
    })
