<script src='//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min.js'></script>
<script src='//cdnjs.cloudflare.com/ajax/libs/knockout.mapping/2.4.1/knockout.mapping.min.js'></script>
<script src='//cdnjs.cloudflare.com/ajax/libs/selectize.js/0.12.1/js/standalone/selectize.min.js'></script><script>
{% comment %}
from http://stackoverflow.com/questions/22706765/twitter-bootstrap-3-modal-with-knockout
could also use https://github.com/billpull/knockout-bootstrap or
http://faulknercs.github.io/Knockstrap/
{% endcomment %}
ko.bindingHandlers.modal = {
    init: function (element, valueAccessor) {
        $(element).modal({show: false});
        var value = valueAccessor();
        if (ko.isObservable(value)) {
            $(element).on('hide.bs.modal', function() {
                value(false);
            });
        }
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            $(element).modal("destroy");
        });
    },
    update: function (element, valueAccessor) {
        var value = valueAccessor();
        var unwrappedValue = ko.unwrap(value);
        if (unwrappedValue) {
            $(element).modal('show');
            // focus input field inside dialog
            $("input", element).focus();
            $('.has-popover', element).popover({'trigger':'hover'});
        }
        else {
            $(element).modal('hide');
        }
    }
};
// provides selectize KO support via https://gist.github.com/xtranophilist/8001624
var injectBinding = function (allBindings, key, value) {
    //https://github.com/knockout/knockout/pull/932#issuecomment-26547528
    return {
        has: function (bindingKey) {
            return (bindingKey == key) || allBindings.has(bindingKey);
        },
        get: function (bindingKey) {
            var binding = allBindings.get(bindingKey);
            if (bindingKey == key) {
                binding = binding ? [].concat(binding, value) : value;
            }
            return binding;
        }
    };
}

ko.bindingHandlers.selectize = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        if (!allBindingsAccessor.has('optionsText'))
            allBindingsAccessor = injectBinding(allBindingsAccessor, 'optionsText', 'name');
        if (!allBindingsAccessor.has('optionsValue'))
            allBindingsAccessor = injectBinding(allBindingsAccessor, 'optionsValue', 'id');
        if (typeof allBindingsAccessor.get('optionsCaption') == 'undefined')
            allBindingsAccessor = injectBinding(allBindingsAccessor, 'optionsCaption', 'Choose...');

        ko.bindingHandlers.options.update(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);

        var options = {
            valueField: allBindingsAccessor.get('optionsValue'),
            labelField: allBindingsAccessor.get('optionsText'),
            searchField: allBindingsAccessor.get('optionsText')
        }

        if (allBindingsAccessor.has('options')) {
            var passed_options = allBindingsAccessor.get('options')
            for (var attr_name in passed_options) {
                options[attr_name] = passed_options[attr_name];
            }
        }

        var $select = $(element).selectize(options)[0].selectize;

        if (typeof allBindingsAccessor.get('value') == 'function') {
            $select.addItem(allBindingsAccessor.get('value')());
            allBindingsAccessor.get('value').subscribe(function (new_val) {
                $select.addItem(new_val);
            })
        }

        if (typeof allBindingsAccessor.get('selectedOptions') == 'function') {
            allBindingsAccessor.get('selectedOptions').subscribe(function (new_val) {
                // Removing items which are not in new value
                var values = $select.getValue();
                var items_to_remove = [];
                for (var k in values) {
                    if (new_val.indexOf(values[k]) == -1) {
                        items_to_remove.push(values[k]);
                    }
                }

                for (var k in items_to_remove) {
                    $select.removeItem(items_to_remove[k]);
                }

                for (var k in new_val) {
                    $select.addItem(new_val[k]);
                }

            });
            var selected = allBindingsAccessor.get('selectedOptions')();
            for (var k in selected) {
                $select.addItem(selected[k]);
            }
        }


        if (typeof init_selectize == 'function') {
            init_selectize($select);
        }

        if (typeof valueAccessor().subscribe == 'function') {
            valueAccessor().subscribe(function (changes) {
                // To avoid having duplicate keys, all delete operations will go first
                var addedItems = new Array();
                changes.forEach(function (change) {
                    switch (change.status) {
                        case 'added':
                            addedItems.push(change.value);
                            break;
                        case 'deleted':
                            var itemId = change.value[options.valueField];
                            if (itemId != null) $select.removeOption(itemId);
                    }
                });
                addedItems.forEach(function (item) {
                    $select.addOption(item);
                });

            }, null, "arrayChange");
        }

    },
    update: function (element, valueAccessor, allBindingsAccessor) {

        if (allBindingsAccessor.has('object')) {
            var optionsValue = allBindingsAccessor.get('optionsValue') || 'id';
            var value_accessor = valueAccessor();
            var selected_obj = $.grep(value_accessor(), function (i) {
                if (typeof i[optionsValue] == 'function')
                    var id = i[optionsValue]
                else
                    var id = i[optionsValue]
                return id == allBindingsAccessor.get('value')();
            })[0];

            if (selected_obj) {
                allBindingsAccessor.get('object')(selected_obj);
            }
        }
    }
}
</script>

