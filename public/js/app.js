const requestModal = document.querySelector('.new-request');
const requestLink = document.querySelector('.add-request');
const requestForm = document.querySelector('.new-request form');

requestLink.addEventListener('click', () => {
    requestModal.classList.add('open');
});
//close request modal
requestModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('new-request')) {
        requestModal.classList.remove('open');
    }
});
//add new request
requestForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const addRequest = firebase.functions().httpsCallable('addRequest');
    addRequest({
        text: requestForm.request.value
    }).then(() => {
        requestForm.reset();
        requestModal.classList.remove('open');
    }).catch(error => {
        requestForm.querySelector('.error').textContent = error.message;
    });
});