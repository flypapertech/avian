// Inbox Vue Component

new Vue(
    {
        el: "#app",
        data: {
            storage: {}
        },
        mounted: () => {
            let index = this;
            $.ajax({
                url: "/index/storage/objects.json",
                method: 'GET',
                success: (objects) => {
                    index.storage = objects;
                },
                error: function (error) {
                    console.log(error);
                }
            });
        }
    })
