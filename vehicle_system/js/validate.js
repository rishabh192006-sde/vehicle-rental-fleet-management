'use strict';



(() => {

    const DEBUG = false;                                   // set true to see logs
    const log = (...args) => { if (DEBUG) console.log('[validate]', ...args); };

    const ready = fn => document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', fn)
        : fn();

    const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;


    /* ---------- one small function per rule (empty string = valid) ---------- */

    const checkRequired = value =>
        value.trim() ? '' : 'This field is required';

    const checkName = value => {
        const text = value.trim();
        if (!text) return 'Name is required';
        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(text)) return 'Use letters only';
        if (text.length < 2) return 'Name is too short';
        return '';
    };

    const checkEmail = value => {
        const text = value.trim();
        if (!text) return 'Email is required';
        if (!EMAIL_PATTERN.test(text)) return 'Enter a valid email, e.g. name@example.com';
        return '';
    };

    const checkPhone = value => {
        if (!value) return 'Phone number is required';
        if (!/^\d+$/.test(value)) return 'Digits only';
        if (!/^[6-9]/.test(value)) return 'Mobile numbers start with 6, 7, 8 or 9';
        if (value.length < 10) return `Enter all 10 digits (${value.length}/10)`;
        return '';
    };

    const checkPassword = value => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'At least 8 characters';
        if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Use both letters and numbers';
        return '';
    };

    const checkDays = value => {
        if (!value) return 'Enter the number of days';
        const days = Number(value);                       // type conversion: string -> number
        if (!Number.isInteger(days) || days < 1) return 'Enter a whole number, 1 or more';
        if (days > 30) return 'Maximum 30 days per booking';
        return '';
    };

    const checkDate = (value, field) => {
        if (!value) return 'Choose a rental date';
        if (field.min && value < field.min) return 'Date cannot be in the past';
        return '';
    };

    const checkMessage = value => {
        const text = value.trim();
        if (!text) return 'This field is required';
        if (text.length < 10) return 'Please write at least 10 characters';
        return '';
    };

    const checkSelect = value =>
        value ? '' : 'Please choose an option';


    /* ---------- pick the right rule with a switch ---------- */

    function getError(field) {
        const value = field.value;

        switch (field.dataset.validate) {
            case 'name': return checkName(value);
            case 'email': return checkEmail(value);
            case 'phone': return checkPhone(value);
            case 'password': return checkPassword(value);
            case 'days': return checkDays(value);
            case 'hours': return checkDays(value);   // legacy alias
            case 'date': return checkDate(value, field);
            case 'message': return checkMessage(value);
            case 'select': return checkSelect(value);
            default: return checkRequired(value);  // "required" and anything unknown
        }
    }

    /* Remove characters that can never be valid for this field type. */
    function cleanValue(type, value) {
        switch (type) {
            case 'phone': return value.replace(/\D/g, '').slice(0, 10);
            case 'days': return value.replace(/\D/g, '').slice(0, 2);
            case 'hours': return value.replace(/\D/g, '').slice(0, 2);
            case 'name': return value.replace(/[^A-Za-z .'-]/g, '');
            default: return value;
        }
    }

    /* Characters allowed per keystroke (checked in "beforeinput"). */
    const ALLOWED_CHARS = {
        phone: /^\d*$/,
        name: /^[A-Za-z .'-]*$/
    };


    /* ---------- FieldValidator: one instance per field ---------- */

    class FieldValidator {

        constructor(field) {
            this.field = field;
            this.type = field.dataset.validate;
            this.touched = false;
            this.message = this.createMessage();
            this.prepare();
            this.bindEvents();
        }

        createMessage() {
            const message = document.createElement('small');
            message.className = 'field-msg';
            message.setAttribute('aria-live', 'polite');
            this.field.parentNode.appendChild(message);
            return message;
        }

        prepare() {
            const { field, type } = this;

            if (type === 'phone') {
                field.setAttribute('inputmode', 'numeric');
                field.setAttribute('maxlength', '10');
                field.setAttribute('autocomplete', 'tel-national');
            }
            if (type === 'hours') field.setAttribute('inputmode', 'numeric');

            if (type === 'date' && !field.min) {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                field.min = `${yyyy}-${mm}-${dd}`;
            }
        }

        bindEvents() {
            const { field, type } = this;

            if (ALLOWED_CHARS[type]) {
                field.addEventListener('beforeinput', event => {
                    if (event.data && !ALLOWED_CHARS[type].test(event.data)) {
                        event.preventDefault();                          // block the keystroke
                    }
                });
            }

            field.addEventListener('input', () => {
                const cleaned = cleanValue(type, field.value);           // also fixes pasted text
                if (cleaned !== field.value) field.value = cleaned;
                this.paint(this.touched);
            });

            field.addEventListener('change', () => {
                this.touched = true;
                this.paint(true);
            });

            field.addEventListener('blur', () => {
                if (field.value !== '' || this.touched) {
                    this.touched = true;
                    this.paint(true);
                }
            });
        }

        /* Update colours + message. Returns true when the value is valid. */
        paint(showError) {
            const error = getError(this.field);
            const { field, message } = this;

            field.classList.remove('is-valid', 'is-invalid');
            message.className = 'field-msg';
            message.textContent = '';

            if (!error) {
                field.classList.add('is-valid');
                message.classList.add('ok');
                message.textContent = '✓ Looks good';
                field.setAttribute('aria-invalid', 'false');
            } else if (showError) {
                field.classList.add('is-invalid');
                message.classList.add('bad');
                message.textContent = error;
                field.setAttribute('aria-invalid', 'true');
            }

            log(this.type, error || 'valid');
            return !error;
        }

        reset() {
            this.touched = false;
            this.field.classList.remove('is-valid', 'is-invalid');
            this.message.textContent = '';
        }
    }


    /* ---------- wire up each form ---------- */

    function setUpForm(form) {
        const fields = form.querySelectorAll('[data-validate]');
        if (fields.length === 0) return;

        form.setAttribute('novalidate', '');                   // we show our own messages
        const validators = [...fields].map(field => new FieldValidator(field));

        form.addEventListener('submit', event => {
            let firstBad = null;

            validators.forEach(validator => {
                validator.touched = true;
                const ok = validator.paint(true);
                if (!ok && !firstBad) firstBad = validator.field;
            });

            if (firstBad) {
                event.preventDefault();
                firstBad.focus();
                return;
            }

            /* everything is valid – let page scripts react */
            const proceed = form.dispatchEvent(
                new CustomEvent('form:valid', { cancelable: true })
            );
            if (!proceed) {
                event.preventDefault();                        // a page script took over
                return;
            }

            if (form.dataset.success) {                        // e.g. the contact form
                event.preventDefault();
                showSuccess(form, form.dataset.success);
                form.reset();
                validators.forEach(validator => validator.reset());
            }
        });
    }

    function showSuccess(form, text) {
        let box = form.querySelector('.form-success');
        if (!box) {
            box = document.createElement('div');
            box.className = 'form-success';
            form.prepend(box);
        }
        box.textContent = text;
    }

    ready(() => [...document.forms].forEach(setUpForm));

})();
