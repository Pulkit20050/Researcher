// ### CONFIGURATION ###
const API_ATTENDANCE_URL = 'http://127.0.0.1:5000/upload';

// ### DOM REFERENCES ###
const openCameraBtn = document.getElementById('open-camera-btn');
const closeCameraBtn = document.getElementById('close-camera-btn');
const shutterBtn = document.getElementById('shutter-btn');
const uploadBatchBtn = document.getElementById('upload-batch-btn');
const cameraModal = document.getElementById('camera-modal');
const thumbnailGallery = document.getElementById('thumbnail-gallery');
const video = document.getElementById('video');
const canvasOutput = document.getElementById('canvas-output');
const captureCanvas = document.getElementById('capture-canvas');
const messageBox = document.getElementById('message-box');
const studentsTableBody = document.querySelector("#students-table tbody");
const pieChartCanvas = document.getElementById('attendancePieChart');

// ### STATE MANAGEMENT ###
let studentData = [];
let capturedImages = [];
let streaming = false;
let myPieChart = null;
let faceCascade, videoCapture, src, gray, faces, mediaStream;
let isModelLoaded = false;

// ### INITIALIZATION ###
// APK NOTE: When building your APK, you may need to handle permissions for Camera and Internet access.
document.addEventListener('DOMContentLoaded', () => {
    // Using mock data so the app is fully testable without a live server.
    studentData = [
        { "Name": "Alice Smith", "Total hours": 80, "Number of hours present": 78, "Phone number": "+1234567890", "lastAttendanceDate": "2025-09-25" },
        { "Name": "Bob Johnson", "Total hours": 80, "Number of hours present": 60, "Phone number": "+1987654321", "lastAttendanceDate": "2025-09-25" },
        { "Name": "Charlie Brown", "Total hours": 80, "Number of hours present": 75, "Phone number": "", "lastAttendanceDate": "2025-09-25" },
        { "Name": "Diana Prince", "Total hours": 80, "Number of hours present": 35, "Phone number": "+1555443322", "lastAttendanceDate": "2025-09-24" },
        { "Name": "Ethan Hunt", "Total hours": 80, "Number of hours present": 50, "Phone number": "+1122334455", "lastAttendanceDate": "2025-09-25" }
    ];
});

// ### EVENT LISTENERS ###
openCameraBtn.addEventListener('click', () => {
    cameraModal.style.display = 'flex';
    initializeCamera();
});
closeCameraBtn.addEventListener('click', () => {
    cameraModal.style.display = 'none';
    stopCamera();
});
shutterBtn.addEventListener('click', capturePhoto);
uploadBatchBtn.addEventListener('click', handleBatchUpload);

// ### CORE LOGIC ###
function capturePhoto() {
    if (!streaming) return;
    const w = video.videoWidth; const h = video.videoHeight;
    captureCanvas.width = w; captureCanvas.height = h;
    const ctx = captureCanvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();
    const imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
    capturedImages.push(imageDataUrl);
    updateThumbnails();
    uploadBatchBtn.disabled = false;
}

function updateThumbnails() {
    thumbnailGallery.innerHTML = '';
    capturedImages.forEach(imgDataUrl => {
        const img = document.createElement('img');
        img.src = imgDataUrl;
        img.className = 'thumbnail';
        thumbnailGallery.appendChild(img);
    });
}

function handleBatchUpload() {
    if (capturedImages.length === 0) return;
    
    uploadBatchBtn.disabled = true;
    messageBox.textContent = `Uploading ${capturedImages.length} images...`;
    messageBox.style.color = 'black';

    // This is the real fetch request to your server.
    fetch(API_ATTENDANCE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: capturedImages })
    })
    .then(response => {
        if (!response.ok) throw new Error(`Network Error: ${response.statusText}`);
        return response.json();
    })
    .then(data => {
        messageBox.style.color = 'green';
        messageBox.textContent = 'Success! Processing records...';
        processAttendanceUpdate(data);
    })
    .catch(error => {
        console.error('Upload Error:', error);
        messageBox.style.color = 'red';
        messageBox.textContent = 'Upload failed. Check console and server.';
    })
    .finally(() => {
        capturedImages = [];
        updateThumbnails();
        setTimeout(() => {
            uploadBatchBtn.disabled = true;
            messageBox.textContent = '';
        }, 4000);
    });
}

function processAttendanceUpdate(data) {
    const presentNames = data.present || [];
    const today = new Date().toISOString().split('T')[0];
    let updatedCount = 0;

    studentData.forEach(student => {
        if (presentNames.includes(student.Name) && student.lastAttendanceDate !== today) {
            student['Number of hours present']++;
            student.lastAttendanceDate = today;
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        messageBox.textContent = `${updatedCount} student(s) marked present!`;
        // DEBUG FIX: Update the table and chart after processing.
        renderStudentTable();
        updatePieChart();
    } else {
        messageBox.textContent = "No new attendance records added.";
    }
}

// ### TAB & DYNAMIC CONTENT RENDERING ###
function showTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
    
    const activeTab = document.getElementById(tabId);
    activeTab.classList.add('active');

    if (tabId === 'absentees') renderStudentTable();
    if (tabId === 'insights') updatePieChart();
}

function renderStudentTable() {
    if (!studentsTableBody) return;
    studentsTableBody.innerHTML = '';
    if (!studentData || studentData.length === 0) return;
    studentData.forEach(student => {
        const totalHours = parseInt(student['Total hours']) || 0;
        const presentHours = parseInt(student['Number of hours present']) || 0;
        const phone = student['Phone number'] || '';
        const percentage = totalHours > 0 ? ((presentHours / totalHours) * 100).toFixed(1) : 0;
        const callIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-gray-500 hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>`;
        const row = `<tr><td class="font-semibold">${student.Name}</td><td>${totalHours}</td><td class="font-bold">${presentHours}</td><td class="font-semibold ${percentage < 75 ? 'text-orange-500' : 'text-green-600'}">${percentage}%</td><td>${phone ? `<a href="tel:${phone}">${callIcon}</a>` : ''}</td></tr>`;
        studentsTableBody.innerHTML += row;
    });
}

function updatePieChart() {
    if (!pieChartCanvas || !studentData || studentData.length === 0) return;
    let below50 = 0, between50and79 = 0, above80 = 0;
    studentData.forEach(s => {
        const p = (s['Total hours'] > 0) ? (s['Number of hours present'] / s['Total hours']) * 100 : 0;
        if (p < 50) below50++;
        else if (p >= 50 && p < 80) between50and79++;
        else above80++;
    });
    const chartData = {
        labels: [`Below 50% (${below50})`, `50% - 79% (${between50and79})`, `80% - 100% (${above80})`],
        datasets: [{
            data: [below50, between50and79, above80],
            backgroundColor: ['rgb(239, 68, 68)', 'rgb(249, 115, 22)', 'rgb(34, 197, 94)'],
            hoverOffset: 4
        }]
    };
    if (myPieChart) myPieChart.destroy();
    myPieChart = new Chart(pieChartCanvas, { type: 'pie', data: chartData, options: { responsive: true, plugins: { legend: { position: 'top' } } } });
}

// ### OPENCV & CAMERA LOGIC ###
function onOpenCvReady() {
    cv.onRuntimeInitialized = () => {
        console.log("OpenCV is ready.");
        faceCascade = new cv.CascadeClassifier();
        const cascadeUrl = 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml';
        const utils = new Utils();
        utils.createFileFromUrl('face.xml', cascadeUrl, () => {
            faceCascade.load('face.xml');
            isModelLoaded = true;
            console.log("Face detection model loaded successfully.");
        });
    };
}

function initializeCamera() {
    if (!isModelLoaded) {
        messageBox.textContent = "AI Model is loading, please wait...";
        setTimeout(initializeCamera, 500);
        return;
    }
    messageBox.textContent = "";
    startCamera();
}

function startCamera() {
    if (streaming) return;
    // MOBILE OPTIMIZATION: Prioritizing the back camera ('environment').
    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' }
        },
        audio: false
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            mediaStream = stream;
            video.srcObject = stream;
            video.play();
        }).catch(err => {
            console.error("Camera access error:", err);
            // Fallback for devices without a back camera
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(stream => {
                    mediaStream = stream;
                    video.srcObject = stream;
                    video.play();
                }).catch(err2 => console.error("Camera access failed entirely:", err2));
        });
}

video.addEventListener('canplay', () => {
    if (streaming) return;
    streaming = true;
    const w = video.videoWidth, h = video.videoHeight;
    canvasOutput.width = w; canvasOutput.height = h;
    src = new cv.Mat(h, w, cv.CV_8UC4);
    gray = new cv.Mat(h, w, cv.CV_8UC1);
    faces = new cv.RectVector();
    videoCapture = new cv.VideoCapture(video);
    requestAnimationFrame(processVideo);
});

function processVideo() {
    if (!streaming || !isModelLoaded) {
        requestAnimationFrame(processVideo);
        return;
    }
    try {
        videoCapture.read(src);
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0);
        const ctx = canvasOutput.getContext('2d');
        ctx.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
        for (let i = 0; i < faces.size(); ++i) {
            const face = faces.get(i);
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 3;
            ctx.strokeRect(face.x, face.y, face.width, face.height);
        }
        requestAnimationFrame(processVideo);
    } catch (err) { /* Ignore errors */ }
}

function stopCamera() {
    if (!streaming) return;
    streaming = false;
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    // Gracefully release OpenCV resources
    if (src) src.delete();
    if (gray) gray.delete();
    if (faces) faces.delete();
    const ctx = canvasOutput.getContext('2d');
    ctx.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
}

function Utils() {
    this.createFileFromUrl = function(path, url, callback) {
        let request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = function() {
            if (request.readyState === 4 && request.status === 200) {
                let data = new Uint8Array(request.response);
                cv.FS_createDataFile('/', path, data, true, false, false);
                callback();
            }
        };
        request.send();
    };
}