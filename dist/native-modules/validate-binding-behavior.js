import { Optional } from 'aurelia-dependency-injection';
import { DOM } from 'aurelia-pal';
import { TaskQueue } from 'aurelia-task-queue';
import { ValidationController } from './validation-controller';
import { validateTrigger } from './validate-trigger';
/**
 * Binding behavior. Indicates the bound property should be validated.
 */
export var ValidateBindingBehavior = (function () {
    function ValidateBindingBehavior(taskQueue) {
        this.taskQueue = taskQueue;
    }
    /**
    * Gets the DOM element associated with the data-binding. Most of the time it's
    * the binding.target but sometimes binding.target is an aurelia custom element,
    * or custom attribute which is a javascript "class" instance, so we need to use
    * the controller's container to retrieve the actual DOM element.
    */
    ValidateBindingBehavior.prototype.getTarget = function (binding, view) {
        var target = binding.target;
        // DOM element
        if (target instanceof Element) {
            return target;
        }
        // custom element or custom attribute
        for (var i = 0, ii = view.controllers.length; i < ii; i++) {
            var controller = view.controllers[i];
            if (controller.viewModel === target) {
                var element = controller.container.get(DOM.Element);
                if (element) {
                    return element;
                }
                throw new Error("Unable to locate target element for \"" + binding.sourceExpression + "\".");
            }
        }
        throw new Error("Unable to locate target element for \"" + binding.sourceExpression + "\".");
    };
    ValidateBindingBehavior.prototype.bind = function (binding, source, rulesOrController, rules) {
        var _this = this;
        // identify the target element.
        var target = this.getTarget(binding, source);
        // locate the controller.
        var controller;
        if (rulesOrController instanceof ValidationController) {
            controller = rulesOrController;
        }
        else {
            controller = source.container.get(Optional.of(ValidationController));
            rules = rulesOrController;
        }
        if (controller === null) {
            throw new Error("A ValidationController has not been registered.");
        }
        controller.registerBinding(binding, target, rules);
        binding.validationController = controller;
        if (controller.validateTrigger === validateTrigger.change) {
            binding.standardUpdateSource = binding.updateSource;
            binding.updateSource = function (value) {
                this.standardUpdateSource(value);
                this.validationController.validateBinding(this);
            };
        }
        else if (controller.validateTrigger === validateTrigger.blur) {
            binding.validateBlurHandler = function () {
                _this.taskQueue.queueMicroTask(function () { return controller.validateBinding(binding); });
            };
            binding.validateTarget = target;
            target.addEventListener('blur', binding.validateBlurHandler);
        }
        if (controller.validateTrigger !== validateTrigger.manual) {
            binding.standardUpdateTarget = binding.updateTarget;
            binding.updateTarget = function (value) {
                this.standardUpdateTarget(value);
                this.validationController.resetBinding(this);
            };
        }
    };
    ValidateBindingBehavior.prototype.unbind = function (binding) {
        // reset the binding to it's original state.
        if (binding.standardUpdateSource) {
            binding.updateSource = binding.standardUpdateSource;
            binding.standardUpdateSource = null;
        }
        if (binding.standardUpdateTarget) {
            binding.updateTarget = binding.standardUpdateTarget;
            binding.standardUpdateTarget = null;
        }
        if (binding.validateBlurHandler) {
            binding.validateTarget.removeEventListener('blur', binding.validateBlurHandler);
            binding.validateBlurHandler = null;
            binding.validateTarget = null;
        }
        binding.validationController.unregisterBinding(binding);
        binding.validationController = null;
    };
    ValidateBindingBehavior.inject = [TaskQueue];
    return ValidateBindingBehavior;
}());
