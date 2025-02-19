// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBy8ExrgvBDto-BcNhlvrcC6ZB9G7HNaWE",
    authDomain: "eviltriviagrading.firebaseapp.com",
    databaseURL: "https://eviltriviagrading-default-rtdb.firebaseio.com",
    projectId: "eviltriviagrading",
    storageBucket: "eviltriviagrading.firebasestorage.app",
    messagingSenderId: "738486013114",
    appId: "1:738486013114:web:fe0f480cc3f66f42d6c683",
    measurementId: "G-R84N89NTJZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Select elements
const datePicker = document.getElementById("datePicker");
const fetchDataBtn = document.getElementById("fetchData");
const resultsTable = document.getElementById("resultsTable");

// Function to fetch trivia data and scores
async function fetchTriviaResults() {
    const selectedDate = datePicker.value;
    if (!selectedDate) {
        alert("Please select a date.");
        return;
    }

    const triviaRef = ref(db, `trivia/${selectedDate}`);
    const scoresRef = ref(db, `scores/${selectedDate}`);

    try {
        const [triviaSnapshot, scoresSnapshot] = await Promise.all([
            get(triviaRef),
            get(scoresRef)
        ]);

        if (!triviaSnapshot.exists() || !scoresSnapshot.exists()) {
            alert("No data found for the selected date.");
            return;
        }

        const triviaData = triviaSnapshot.val();
        const scoresData = scoresSnapshot.val();

        const aggregatedResults = aggregateScores(triviaData, scoresData);
        displayResults(aggregatedResults);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Function to aggregate scores for each question
function aggregateScores(trivia, scores) {
    let questionScores = {};

    // Iterate over trivia rounds
    for (let roundType in trivia) {
        const roundQuestions = trivia[roundType];

        for (let questionID in roundQuestions) {
            const questionData = roundQuestions[questionID];

            if (!questionData) continue; // Skip null or undefined entries

            // Initialize the question entry
            if (!questionScores[questionID]) {
                questionScores[questionID] = {
                    roundType: questionData.round_type || roundType,
                    question: questionData.question || "No question text available",
                    answer: questionData.answer || "No answer available",
                    totalPossible: questionData.total_possible_points || 0,
                    scoreCorrect: 0
                };
            }
        }
    }

    // Process scores from all teams
    for (let team in scores) {
        const teamScores = scores[team]?.scores || [];

        for (let round of teamScores) {
            if (!round) continue; // Skip empty or null rounds

            for (let questionID in round) {
                if (questionScores[questionID]) {
                    questionScores[questionID].scoreCorrect += round[questionID] || 0;
                }
            }
        }
    }

    return Object.values(questionScores);
}

// Function to display results in the table
function displayResults(results) {
    resultsTable.innerHTML = ""; // Clear existing rows

    results.forEach(result => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${result.roundType}</td>
            <td>${result.question}</td>
            <td>${result.answer}</td>
            <td>${result.scoreCorrect.toFixed(2)}</td>
            <td>${result.totalPossible}</td>
        `;
        resultsTable.appendChild(row);
    });
}

// Event listener for fetch button
fetchDataBtn.addEventListener("click", fetchTriviaResults);
