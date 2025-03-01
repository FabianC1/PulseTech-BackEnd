import pandas as pd
from sklearn import preprocessing
from sklearn.tree import DecisionTreeClassifier, _tree
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.model_selection import cross_val_score
import csv
import re
import warnings
import sys  # Add this to handle command-line arguments

warnings.filterwarnings("ignore", category=DeprecationWarning)

training = pd.read_csv('csv_files/training.csv')  # Adjusted to the correct path
testing = pd.read_csv('csv_files/Testing.csv')  # Adjusted to the correct path
cols = training.columns
cols = cols[:-1]
x = training[cols]
y = training['prognosis']
y1 = y
reduced_data = training.groupby(training['prognosis']).max()

severityDictionary = dict()
description_list = dict()
precautionDictionary = dict()
symptoms_dict = {}
features = cols

for index, symptom in enumerate(x):
    symptoms_dict[symptom] = index

# Mapping strings to numbers
le = preprocessing.LabelEncoder()
le.fit(y)
y = le.transform(y)

x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)
testx = testing[cols]
testy = testing['prognosis']
testy = le.transform(testy)

clf1 = DecisionTreeClassifier()
clf = clf1.fit(x_train, y_train)
scores = cross_val_score(clf, x_test, y_test, cv=3)
model_accuracy = scores.mean()

# Your existing functions stay intact, nothing is removed:

def getDescription():
    global description_list
    with open('csv_files/symptom_Description.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            _description = {row[0]: row[1]}
            description_list.update(_description)

def getSeverityDict():
    global severityDictionary
    with open('csv_files/Symptom_severity.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        try:
            for row in csv_reader:
                _diction = {row[0]: int(row[1])}
                severityDictionary.update(_diction)
        except:
            pass

def getprecautionDict():
    global precautionDictionary
    with open('csv_files/symptom_precaution.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            _prec = {row[0]: [row[1], row[2], row[3], row[4]]}
            precautionDictionary.update(_prec)

def calc_condition(exp, days):
    sum = 0
    for item in exp:
        sum = sum + severityDictionary[item]
    if ((sum * days) / (len(exp) + 1)) > 13:
        print("\nYou should book consultation from a doctor.")
    else:
        print("\nIt might not be that bad but you should take precautions.")

def print_disease(node):
    node = node[0]
    val = node.nonzero()
    disease = le.inverse_transform(val[0])
    return disease


def tree_to_code(tree, feature_names):
    tree_ = tree.tree_
    feature_name = [
        feature_names[i] if i != _tree.TREE_UNDEFINED else "undefined!"
        for i in tree_.feature
    ]
    chk_dis = ",".join(feature_names).split(",")

    symptoms_present = []
    print("\nMay I know the primary symptom you are experiencing?")
    
    # Ask the primary symptom only once
    while True:
        disease_input = input("").lower().replace(" ", "_")
        conf, cnf_dis = check_pattern(chk_dis, disease_input)
        
        if conf == 1:
            print("\nSearches related to input: ")
            for num, it in enumerate(cnf_dis):
                print(str(num + 1) + ")", it.replace("_", " "))
            conf_inp = 0
            while conf_inp <= 0 or conf_inp > num + 1:
                if num != 0:
                    try:
                        print(f"Select the one you meant (1 to {num+1}):  ", end="")
                        conf_inp = int(input(""))
                    except:
                        print(f"Select the one you meant (1 to {num+1}):  ", end="")
                        conf_inp = int(input(""))
                else:
                    conf_inp = 0
                    break
            disease_input = cnf_dis[conf_inp - 1]
            break
        else:
            print("\nI am sorry. It is not registered in our database. Enter another symptom.")

    while True:
        try:
            num_days = int(input("\nOkay. For how many days? "))
            break
        except:
            print("\nEnter number of days.")

    def recurse(node, depth):
        if tree_.feature[node] != _tree.TREE_UNDEFINED:
            name = feature_name[node]
            threshold = tree_.threshold[node]
            if name == disease_input:
                val = 1
            else:
                val = 0
            if val <= threshold:
                recurse(tree_.children_left[node], depth + 1)
            else:
                symptoms_present.append(name)
                recurse(tree_.children_right[node], depth + 1)
        else:
            present_disease = print_disease(tree_.value[node])
            red_cols = reduced_data.columns
            symptoms_given = red_cols[reduced_data.loc[present_disease].values[0].nonzero()]
            
            print("\nAre you experiencing any of the below symptoms?")
            symptoms_exp = []
            for syms in list(symptoms_given):
                inp = ""
                print(syms.replace("_", " "), "? : (yes/no) ", end="")
                while True:
                    inp = input("")
                    if(inp == "yes" or inp == "no"):
                        break
                    else:
                        print("\nPlease provide proper answer (yes/no) : ")
                if(inp == "yes"):
                    symptoms_exp.append(syms)

            second_prediction = sec_predict(symptoms_exp)
            calc_condition(symptoms_exp, num_days)
            
            # Print the diagnosis and accuracy in the same line
            diagnosis_output = f"You may have {present_disease[0]} | Diagnosis Accuracy: {model_accuracy * 100:.2f}%"
            print(diagnosis_output)  # Print the diagnosis with accuracy
            
            # Print the description in multiple lines without repetition
            description = description_list[present_disease[0].rstrip()]
            description_lines = description.split(". ")  # Split sentences by period and space
            
            for line in description_lines:
                print(line.strip())  # Print each sentence in a new line

            precaution_list = precautionDictionary[present_disease[0]]
            print("\nTake following measures: ")
            for i, j in enumerate(precaution_list):
                print(i + 1, ")", j)  # Do not repeat the diagnosis accuracy here
            
    recurse(0, 1)


def sec_predict(symptoms_exp):
    df = pd.read_csv('csv_files/training.csv')
    X = df.iloc[:, :-1]
    y = df['prognosis']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    rf_clf = DecisionTreeClassifier()
    rf_clf.fit(X_train.values, y_train.values)

    symptoms_dict = {}
    for index, symptom in enumerate(X):
        symptoms_dict[symptom] = index

    input_vector = np.zeros(len(symptoms_dict))
    for item in symptoms_exp:
        input_vector[[symptoms_dict[item]]] = 1

    return rf_clf.predict([input_vector]) 



def check_pattern(dis_list, inp):
    pred_list = []
    ptr = 0
    patt = "^" + inp + "$"
    regexp = re.compile(inp)
    for item in dis_list:
        if regexp.search(item):
            pred_list.append(item)
    if(len(pred_list) > 0):
        return 1, pred_list
    else:
        return ptr, item

# Main function to run the symptom checker with user inputs from command line
def main():
    getSeverityDict()  # Load severity data
    getDescription()  # Load description data
    getprecautionDict()  # Load precaution data

    # Running the tree-based prediction
    tree_to_code(clf, cols)  # Running the main disease prediction function with trained classifier

if __name__ == "__main__":
    while True:  # Keeps the script running to accept multiple inputs
        main()
