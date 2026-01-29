// ============================================
// INICIALIZAÇÃO DO FIREBASE
// ============================================
let db;
let isFirebaseInitialized = false;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    isFirebaseInitialized = true;
    console.log("✅ Firebase inicializado com sucesso!");
    updateFirebaseStatus(true, "Conectado ao Firebase");
} catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
    updateFirebaseStatus(false, "Erro na conexão");
    showFirebaseError();
}

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let tasks = [];
let currentTaskId = null;
let taskToDelete = null;
let draggedTask = null;
let unsubscribe = null;

// ============================================
// FUNÇÕES DE MÁSCARA DE DATA (DD/MM/AAAA)
// ============================================
function applyDateMask(input) {
    let value = input.value.replace(/\D/g, '');
    
    // Aplica a máscara DD/MM/AAAA
    if (value.length > 0) {
        value = value.substring(0, 8);
        
        let formattedValue = '';
        if (value.length > 0) {
            formattedValue = value.substring(0, 2);
        }
        if (value.length > 2) {
            formattedValue += '/' + value.substring(2, 4);
        }
        if (value.length > 4) {
            formattedValue += '/' + value.substring(4, 8);
        }
        
        input.value = formattedValue;
    }
}

function validateDate(dateString) {
    // Verifica formato DD/MM/AAAA
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(dateString)) return false;
    
    const parts = dateString.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Verifica se é uma data válida
    if (year < 1000 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return false;
    
    return true;
}

function formatDate(dateString) {
    if (!dateString) return 'Data não definida';
    
    // Se já está no formato DD/MM/AAAA, retorna como está
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString;
    }
    
    try {
        // Tenta converter de AAAA-MM-DD para DD/MM/AAAA
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        // Tenta converter de qualquer formato Date
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return 'Data inválida';
    }
}

function formatDateToFirestore(dateString) {
    // Converte DD/MM/AAAA para AAAA-MM-DD para armazenamento
    if (!dateString) return '';
    
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return dateString;
}

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function updateFirebaseStatus(connected, message) {
    const indicator = document.getElementById('firebaseStatus');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        indicator.className = 'status-indicator connected';
        statusText.textContent = message;
        statusText.style.color = '#2ed573';
    } else {
        indicator.className = 'status-indicator';
        statusText.textContent = message;
        statusText.style.color = '#ff4757';
    }
}

function showFirebaseError() {
    document.getElementById('loading').innerHTML = `
        <div style="color: #ff4757; text-align: center;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 10px;">Erro de Conexão com Firebase</h3>
            <p style="margin-bottom: 20px;">Verifique se:</p>
            <ul style="text-align: left; display: inline-block; margin-bottom: 20px;">
                <li>✅ Você está conectado à internet</li>
                <li>✅ O Firestore está ativado no Firebase Console</li>
                <li>✅ As regras de segurança permitem leitura/escrita</li>
                <li>✅ As credenciais do Firebase estão corretas</li>
            </ul>
            <button onclick="location.reload()" class="btn" style="margin-top: 20px; background: #667eea; color: white;">
                <i class="fas fa-redo"></i> Tentar novamente
            </button>
        </div>
    `;
}

// ============================================
// FUNÇÕES DO FIRESTORE
// ============================================
function loadTasks() {
    if (!isFirebaseInitialized || !db) {
        console.error("Firebase não inicializado");
        updateFirebaseStatus(false, "Firebase não inicializado");
        return;
    }

    try {
        document.getElementById('loading').style.display = 'block';
        
        unsubscribe = db.collection("tasks")
            .orderBy("order", "asc")
            .onSnapshot(
                (snapshot) => {
                    tasks = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        tasks.push({
                            id: doc.id,
                            name: data.name || '',
                            cost: parseFloat(data.cost) || 0,
                            deadline: data.deadline || '',
                            order: parseInt(data.order) || 0,
                            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                            updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
                        });
                    });
                    
                    document.getElementById('loading').style.display = 'none';
                    updateTaskList();
                    updateFirebaseStatus(true, `${tasks.length} tarefas sincronizadas`);
                },
                (error) => {
                    console.error("Erro no listener do Firestore:", error);
                    updateFirebaseStatus(false, "Erro na sincronização");
                    document.getElementById('loading').style.display = 'none';
                }
            );
        
    } catch (error) {
        console.error("Erro ao carregar tarefas:", error);
        updateFirebaseStatus(false, "Erro ao carregar dados");
        document.getElementById('loading').style.display = 'none';
    }
}

async function addTask(task) {
    if (!isFirebaseInitialized || !db) {
        throw new Error("Firebase não inicializado");
    }

    try {
        // Verificar se já existe tarefa com mesmo nome (case insensitive)
        const existingTask = tasks.find(t => 
            t.name.toLowerCase() === task.name.toLowerCase()
        );
        
        if (existingTask) {
            throw new Error("Já existe uma tarefa com este nome!");
        }

        // Obter a última ordem
        const lastTask = tasks.length > 0 
            ? tasks.reduce((prev, current) => 
                (prev.order > current.order) ? prev : current
              )
            : null;
        
        const order = lastTask ? lastTask.order + 1 : 1;
        
        const docRef = await db.collection("tasks").add({
            name: task.name.trim(),
            cost: parseFloat(task.cost),
            deadline: formatDateToFirestore(task.deadline),
            order: order,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("✅ Tarefa adicionada com ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("❌ Erro ao adicionar tarefa:", error);
        throw error;
    }
}

async function updateTask(id, taskData) {
    if (!isFirebaseInitialized || !db) {
        throw new Error("Firebase não inicializado");
    }

    try {
        // Verificar se já existe outra tarefa com mesmo nome (excluindo a atual)
        const existingTask = tasks.find(t => 
            t.id !== id && 
            t.name.toLowerCase() === taskData.name.toLowerCase()
        );
        
        if (existingTask) {
            throw new Error("Já existe uma tarefa com este nome!");
        }

        await db.collection("tasks").doc(id).update({
            name: taskData.name.trim(),
            cost: parseFloat(taskData.cost),
            deadline: formatDateToFirestore(taskData.deadline),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Tarefa atualizada:", id);
    } catch (error) {
        console.error("❌ Erro ao atualizar tarefa:", error);
        throw error;
    }
}

async function deleteTaskFromFirebase(id) {
    if (!isFirebaseInitialized || !db) {
        throw new Error("Firebase não inicializado");
    }

    try {
        await db.collection("tasks").doc(id).delete();
        console.log("✅ Tarefa excluída:", id);
    } catch (error) {
        console.error("❌ Erro ao excluir tarefa:", error);
        throw error;
    }
}

async function updateTaskOrder(taskId, newOrder) {
    if (!isFirebaseInitialized || !db) return;

    try {
        await db.collection("tasks").doc(taskId).update({
            order: parseInt(newOrder),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("❌ Erro ao atualizar ordem:", error);
    }
}

// ============================================
// FUNÇÕES DA INTERFACE
// ============================================
function updateTaskList() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    if (tasks.length === 0) {
        taskList.innerHTML = `
            <div class="loading">
                <i class="" style="font-size: 48px; color: #667eea; margin-bottom: 20px;"></i>
                <p>Nenhuma tarefa cadastrada. Clique em "Nova Tarefa" para começar!</p>
            </div>
        `;
        updateTotalCost();
        return;
    }
    
    // Ordena as tarefas pela ordem
    tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.cost >= 1000 ? 'high-cost' : ''}`;
        li.setAttribute('data-id', task.id);
        li.setAttribute('draggable', 'true');
        
        const shortId = task.id.substring(0, 8);
        
        li.innerHTML = `
            <div class="drag-handle">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="task-info">
                <div class="task-name">${task.name || 'Sem nome'}</div>
                <div class="task-cost">${formatCurrency(task.cost)}</div>
                <div class="task-deadline">${formatDate(task.deadline)}</div>
                <div class="task-id" title="ID: ${task.id}">ID: ${shortId}</div>
            </div>
            <div class="task-actions">
                <div class="order-buttons">
                    <button class="btn btn-up" onclick="moveTaskUp('${task.id}')" ${index === 0 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="btn btn-down" onclick="moveTaskDown('${task.id}')" ${index === tasks.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </div>
                <button class="btn btn-edit" onclick="editTask('${task.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-delete" onclick="showDeleteConfirm('${task.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
        
        // Eventos de drag-and-drop
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);
        
        taskList.appendChild(li);
    });
    
    updateTotalCost();
}

function updateTotalCost() {
    const total = tasks.reduce((sum, task) => sum + (parseFloat(task.cost) || 0), 0);
    document.getElementById('totalCost').textContent = formatCurrency(total);
}

// ============================================
// FUNÇÕES DOS MODAIS
// ============================================
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    document.getElementById('taskForm').reset();
    document.querySelectorAll('.error-message').forEach(msg => msg.style.display = 'none');
    currentTaskId = null;
    
    // Limpar o campo de data e mostrar o placeholder
    document.getElementById('taskDeadline').value = '';
    
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskName').focus();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) {
        alert('Tarefa não encontrada!');
        return;
    }
    
    document.getElementById('modalTitle').textContent = 'Editar Tarefa';
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskCost').value = task.cost;
    
    // Formatar data para exibição
    document.getElementById('taskDeadline').value = formatDate(task.deadline);
    
    document.querySelectorAll('.error-message').forEach(msg => msg.style.display = 'none');
    currentTaskId = id;
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskName').focus();
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

// ============================================
// MANIPULAÇÃO DO FORMULÁRIO
// ============================================
document.getElementById('taskForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('taskName').value.trim();
    const cost = parseFloat(document.getElementById('taskCost').value);
    const deadline = document.getElementById('taskDeadline').value.trim();
    
    // Validações
    let isValid = true;
    document.querySelectorAll('.error-message').forEach(msg => msg.style.display = 'none');
    
    // Validação do nome
    if (name === '') {
        isValid = false;
        document.getElementById('nameError').textContent = 'O nome da tarefa é obrigatório!';
        document.getElementById('nameError').style.display = 'block';
    }
    
    // Validação do custo
    if (isNaN(cost) || cost < 0) {
        isValid = false;
        document.getElementById('costError').textContent = 'O custo deve ser um número maior ou igual a zero!';
        document.getElementById('costError').style.display = 'block';
    }
    
    // Validação da data (formato DD/MM/AAAA)
    if (!deadline || !validateDate(deadline)) {
        isValid = false;
        document.getElementById('dateError').textContent = 'Informe uma data válida no formato DD/MM/AAAA!';
        document.getElementById('dateError').style.display = 'block';
    }
    
    if (!isValid) return;
    
    const taskData = {
        name: name,
        cost: cost,
        deadline: deadline
    };
    
    try {
        const saveButton = document.querySelector('.btn-save');
        const originalText = saveButton.textContent;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        saveButton.disabled = true;
        
        if (currentTaskId) {
            await updateTask(currentTaskId, taskData);
        } else {
            await addTask(taskData);
        }
        
        saveButton.textContent = originalText;
        saveButton.disabled = false;
        closeModal();
    } catch (error) {
        if (error.message.includes("Já existe uma tarefa com este nome!")) {
            document.getElementById('nameError').textContent = error.message;
            document.getElementById('nameError').style.display = 'block';
        } else {
            alert('❌ Erro ao salvar tarefa. Verifique sua conexão com a internet e tente novamente.');
            console.error('Erro detalhado:', error);
        }
        const saveButton = document.querySelector('.btn-save');
        saveButton.textContent = 'Salvar';
        saveButton.disabled = false;
    }
});

// ============================================
// FUNÇÕES DE EXCLUSÃO
// ============================================
function showDeleteConfirm(id) {
    taskToDelete = id;
    const task = tasks.find(t => t.id === id);
    if (!task) {
        alert('Tarefa não encontrada!');
        return;
    }
    document.getElementById('confirmMessage').textContent = 
        `Tem certeza que deseja excluir a tarefa❓{ ${task.name} }❓\n\n`;
    document.getElementById('confirmModal').style.display = 'flex';
}

async function confirmDelete() {
    if (!taskToDelete) return;
    
    try {
        const deleteButton = document.querySelector('.btn-yes');
        const originalText = deleteButton.textContent;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        deleteButton.disabled = true;
        
        await deleteTaskFromFirebase(taskToDelete);
        
        deleteButton.textContent = originalText;
        deleteButton.disabled = false;
        closeConfirmModal();
    } catch (error) {
        alert('❌ Erro ao excluir tarefa. Verifique sua conexão e tente novamente.');
        console.error('Erro detalhado:', error);
        const deleteButton = document.querySelector('.btn-yes');
        deleteButton.textContent = 'Sim, Excluir';
        deleteButton.disabled = false;
    }
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    taskToDelete = null;
}

// ============================================
// FUNÇÕES DE ORDENAÇÃO
// ============================================
async function moveTaskUp(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex <= 0) return;
    
    const task = tasks[taskIndex];
    const prevTask = tasks[taskIndex - 1];
    
    // Trocar as ordens
    const tempOrder = task.order;
    task.order = prevTask.order;
    prevTask.order = tempOrder;
    
    // Atualizar no Firebase
    try {
        await Promise.all([
            updateTaskOrder(id, task.order),
            updateTaskOrder(prevTask.id, prevTask.order)
        ]);
    } catch (error) {
        alert('Erro ao mover tarefa. Tente novamente.');
        loadTasks();
    }
}

async function moveTaskDown(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex >= tasks.length - 1) return;
    
    const task = tasks[taskIndex];
    const nextTask = tasks[taskIndex + 1];
    
    // Trocar as ordens
    const tempOrder = task.order;
    task.order = nextTask.order;
    nextTask.order = tempOrder;
    
    // Atualizar no Firebase
    try {
        await Promise.all([
            updateTaskOrder(id, task.order),
            updateTaskOrder(nextTask.id, nextTask.order)
        ]);
    } catch (error) {
        alert('Erro ao mover tarefa. Tente novamente.');
        loadTasks();
    }
}

// ============================================
// FUNÇÕES DE DRAG-AND-DROP
// ============================================
function handleDragStart(e) {
    draggedTask = e.target.closest('.task-item');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTask.getAttribute('data-id'));
    setTimeout(() => draggedTask.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(e.clientY);
    const taskList = document.querySelector('.task-list');
    
    if (afterElement == null) {
        taskList.appendChild(draggedTask);
    } else {
        taskList.insertBefore(draggedTask, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
    return false;
}

async function handleDragEnd() {
    draggedTask.classList.remove('dragging');
    
    const taskItems = Array.from(document.querySelectorAll('.task-item'));
    const newOrders = {};
    taskItems.forEach((item, index) => {
        const taskId = item.getAttribute('data-id');
        newOrders[taskId] = index + 1;
    });
    
    for (const taskId in newOrders) {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.order !== newOrders[taskId]) {
            await updateTaskOrder(taskId, newOrders[taskId]);
        }
    }
    
    draggedTask = null;
}

function getDragAfterElement(y) {
    const draggableElements = [...document.querySelectorAll('.task-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar a aplicação
    if (isFirebaseInitialized) {
        loadTasks();
    } else {
        showFirebaseError();
    }
    
    // Fecha modais ao clicar fora
    window.addEventListener('click', (e) => {
        const taskModal = document.getElementById('taskModal');
        const confirmModal = document.getElementById('confirmModal');
        
        if (e.target === taskModal) {
            closeModal();
        }
        if (e.target === confirmModal) {
            closeConfirmModal();
        }
    });
    
    // Fecha modais com tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
        }
    });
    
    // Limpar listener do Firebase ao sair da página
    window.addEventListener('beforeunload', () => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
    
    // Configurar máscara de data no input
    const deadlineInput = document.getElementById('taskDeadline');
    deadlineInput.addEventListener('input', function(e) {
        applyDateMask(e.target);
    });
    
    // Permitir navegação com teclas de seta
    deadlineInput.addEventListener('keydown', function(e) {
        // Permitir Backspace, Delete, Tab, setas, Home, End
        if ([8, 9, 37, 38, 39, 40, 46, 36, 35].includes(e.keyCode)) {
            return;
        }
        
        // Bloquear teclas não numéricas
        if (!((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105))) {
            e.preventDefault();
        }
    });
});