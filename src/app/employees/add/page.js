'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ArrowLeft, Save, X, User, Mail, Phone, Calendar, MapPin, Building2, Shield, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { backendApi } from '@/services/api';
import { getCurrentUserName, getCurrentUserRole } from '@/utils/userUtils';

export default function AddEmployeePage({ onSuccess, isModal = false, editingEmployee }) {
  const router = useRouter();
  
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [managers, setManagers] = useState([]);
  const [tlList, setTlList] = useState([]); // ✅ NEW: Team Lead list for EMPLOYEE role
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]); // ✅ ADDED: Store all departments for mapping
  const [designations, setDesignations] = useState([]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: '',
    userId: '',
    roleId: '',
    teamId: '',
    departmentId: '',
    tlId: '', // ✅ NEW: TL reference for EMPLOYEE role
    designationId: '',
    customDesignation: '',
    reportingManagerId: '',
    organizationId: 1, // Default organization
    shiftId: '',
    attendanceAllowed: true,
    hiredAt: '',
    dateOfBirth: '',
    gender: '',
    status: 'ACTIVE',
    profileImage: null, // For image upload
    profileImageBase64: '', // For frontend display
    // Additional professional fields
    emergencyContact: '',
    emergencyPhone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    workEmail: '',
    personalEmail: '',
    skills: '',
    experience: '',
    certifications: '',
    education: '',
    notes: '',
    leavePolicy: '',
    holidayPlan: '',
    baseSite: '',
    sitePool: '',
    attendanceRestriction: '',
    inOutNotification: '',
    workRestriction: '',
    defaultTransport: '',
    // Custom fields for "Other" options
    customTeam: '',
    customDepartment: ''
  });

  const [nextEmployeeId, setNextEmployeeId] = useState('');
  const [employeeIdError, setEmployeeIdError] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false); // ✅ PROFESSIONAL: Track submit attempts only
  const totalSteps = 2;

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // ✅ ROLE-BASED: Use different department sources based on role
  useEffect(() => {
    const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
    const roleName = selectedRole?.name;
    
    if (roleName === 'TL') {
      // 🔥 RESET departmentId when switching to TL to avoid old object values
      setFormData(prev => ({
        ...prev,
        departmentId: ''
      }));
      
      // For TL, fetch departments from stages API (string values)
      backendApi.get('/stages/departments').then((stagesDepartments) => {
        const cleanDepartments = (stagesDepartments || [])
          .map(dept => {
            // If API accidentally sends objects, extract name safely
            if (typeof dept === 'string') return dept.trim();
            if (typeof dept === 'object' && dept !== null) {
              return (dept.name || dept.department || '').trim();
            }
            return '';
          })
          .filter(Boolean); // remove empty strings

        setDepartments(cleanDepartments);
        
        // Also fetch all departments for mapping to departmentId
        if (!allDepartments.length) {
          backendApi.get('/departments').then(allDepts => {
            setAllDepartments(allDepts || []);
          }).catch(() => {
            setAllDepartments([]);
          });
        }
      }).catch(() => {
        setDepartments([]);
      });
    } else {
      // For non-TL roles, fetch from departments API (existing behavior)
      backendApi.get('/departments').then(departmentsData => {
        setDepartments(departmentsData || []);
      }).catch(() => {
        setDepartments([]);
      });
    }
  }, [formData.roleId, roles, allDepartments.length]);

  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      
      // Fetch all dropdown data in parallel with error handling
      const [rolesData, managersData, tlData, teamsData, departmentsData, designationsData, nextIdData] = await Promise.allSettled([
        backendApi.get('/roles'),
        backendApi.get('/employees/managers'), // ✅ FIXED: Fetch only managers
        backendApi.get('/employees?role=TL'), // ✅ NEW: Fetch only TLs
        backendApi.get('/teams'),
        backendApi.get('/departments').catch(() => []), // Handle missing departments endpoint
        backendApi.get('/designations'),
        backendApi.get('/employees/next-employee-id')
      ]);

      setRoles(rolesData.status === 'fulfilled' ? rolesData.value : []);
      
      // ✅ FIXED: Show only managers as potential reporting managers
      const managerEmployees = managersData.status === 'fulfilled' ? managersData.value || [] : [];
      setManagers(managerEmployees);
      
      // ✅ NEW: Set TL list for EMPLOYEE role
      const tlEmployees = tlData.status === 'fulfilled' ? tlData.value || [] : [];
      setTlList(tlEmployees);
      
      setTeams(teamsData.status === 'fulfilled' ? teamsData.value : []);
      setDepartments(departmentsData.status === 'fulfilled' ? departmentsData.value : []);
      setDesignations(designationsData.status === 'fulfilled' ? designationsData.value : []);
      
      // Set next employee ID
      if (nextIdData.status === 'fulfilled') {
        setNextEmployeeId(nextIdData.value.nextEmployeeId || '');
      }
      
    } catch (err) {
      setError('Failed to load dropdown data');
      console.error('Error fetching dropdown data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const checkEmployeeId = async (employeeId) => {
    if (!employeeId.trim()) {
      setEmployeeIdError('');
      return;
    }
    
    try {
      const response = await fetch(`https://api.yashrajent.com/api/employees/check-employee-id/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkB5YXNoZW50ZXJwcmlzZXMuY29tIiwiaWF0IjoxNzM1ODk2NzQ0LCJleHAiOjE3MzU5ODAzNDR9.test'}`
        }
      });
      
      const data = await response.json();
      if (data.exists) {
        setEmployeeIdError('Employee ID already exists');
      } else {
        setEmployeeIdError('');
      }
    } catch (error) {
      console.error('Error checking employee ID:', error);
    }
  };
  
  const handleEmployeeIdChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, employeeId: value }));
    
    // Check if employee ID already exists
    if (value.trim()) {
      checkEmployeeId(value);
    } else {
      setEmployeeIdError('');
    }
  };
  
  const handleGenerateEmployeeId = async () => {
    try {
      const response = await fetch('https://api.yashrajent.com/api/employees/next-employee-id', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkB5YXNoZW50ZXJwcmlzZXMuY29tIiwiaWF0IjoxNzM1ODk2NzQ0LCJleHAiOjE3MzU5ODAzNDR9.test'}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, employeeId: data.nextEmployeeId }));
        setEmployeeIdError('');
      }
    } catch (error) {
      console.error('Error generating employee ID:', error);
    }
  };

  // Populate form with editingEmployee data when available
  useEffect(() => {
    if (editingEmployee) {
      setFormData(prev => ({
        ...prev,
        ...editingEmployee,
        profileImage: editingEmployee.profileImageUrl
          ? `https://api.yashrajent.com${editingEmployee.profileImageUrl}` 
          : null,
        profileImageBase64: ''
      }));
    }
  }, [editingEmployee]);

  const validateStep = (currentStep) => {
    const errors = {};
    
    if (currentStep === 1) {
      // Basic Information validation
      if (!formData.firstName.trim()) errors.firstName = 'First name is required';
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
      if (formData.phone && !/^[0-9+\-\s()]+$/.test(formData.phone)) errors.phone = 'Invalid phone format';
      // Make role optional for testing
      // Make employeeId optional for testing
      // Make hire date optional for testing
    }
    
    if (currentStep === 2) {
      // Very permissive validation for testing
      // Temporarily make team optional for testing
      // if (!formData.teamId) errors.teamId = 'Team is required';
      // else if (formData.teamId === 'other' && !formData.customTeam.trim()) {
      //   errors.teamId = 'Please enter custom team name';
      // }
      
      // Temporarily make designation optional for testing
      // if (!formData.designationId) errors.designationId = 'Designation is required';
      // else if (formData.designationId === 'other' && !formData.customDesignation.trim()) {
      //   errors.designationId = 'Please enter custom designation';
      // }
      
      if (formData.emergencyPhone && !/^[0-9+\-\s()]+$/.test(formData.emergencyPhone)) {
        errors.emergencyPhone = 'Invalid emergency phone format';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = (e) => {
    if (e) e.preventDefault(); // ✅ EXTRA SAFETY: Prevent any form submission
    console.log("🔄 Next Step clicked. Current step:", step, "Total steps:", totalSteps);
    
    // ✅ PROFESSIONAL UX: Validate current step before proceeding
    setIsSubmitted(true); // Show validation errors for current step
    const isValid = validateStep(step);
    if (!isValid) return;
    
    setIsSubmitted(false); // Reset for next step (professional UX)
    setStep(step + 1);
  };

  const handlePreviousStep = () => {
    setIsSubmitted(false); // ✅ PROFESSIONAL UX: Hide validation errors when going back
    setStep(step - 1);
  };

  // ✅ BLOCK ENTER KEY SUBMIT unless on last step
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && step !== totalSteps) {
      e.preventDefault();
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Required fields validation
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.roleId) errors.roleId = 'Role is required';
    if (!formData.employeeId.trim()) errors.employeeId = 'Employee ID is required';
    if (!formData.hiredAt) errors.hiredAt = 'Hire date is required';
    
    // Email uniqueness check (basic validation)
    if (formData.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.workEmail)) {
      errors.workEmail = 'Invalid work email format';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // ✅ NEW: Handle TL selection and auto-assign department
  const handleTLChange = (tlId) => {
    const selectedTL = tlList.find(tl => tl.id === Number(tlId));
    
    if (selectedTL) {
      setFormData(prev => ({
        ...prev,
        tlId: selectedTL.id,
        departmentId: selectedTL.departmentId || '', // Auto-assign department from TL
        departmentName: selectedTL.departmentName || '' // Store department name
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        tlId: '',
        departmentId: '',
        departmentName: ''
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setFormData(prev => ({
          ...prev,
          profileImageBase64: base64,
          profileImage: URL.createObjectURL(file)
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!formData.profileImage) {
      setError('Please select an image first');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Convert base64 back to file for upload
      const base64Data = formData.profileImageBase64;
      const byteString = atob(base64Data.split(',')[1]);
      const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
      const mime = mimeString.split(':')[1];
      
      const byteNumbers = new Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteNumbers[i] = byteString.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const file = new File([blob], 'employee-image.jpg', { type: mime });

      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      
      const response = await backendApi.post(`/employees/${formData.employeeId}/upload-image`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response && response.imageUrl) {
        setFormData(prev => ({
          ...prev,
          profileImageUrl: response.imageUrl
        }));
        alert('Image uploaded successfully!');
      } else {
        setError('Failed to upload image');
      }
    } catch (err) {
      setError('Failed to upload image');
      console.error('Error uploading image:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ DOUBLE SAFETY: Prevent double submit
    if (saving) return;

    // ✅ Block submit unless on last step
    if (step !== totalSteps) {
      console.warn("🛑 BLOCKED submit before final step. Current step:", step, "Total steps:", totalSteps);
      setError('Please complete all steps before submitting');
      return;
    }

    // ✅ PROFESSIONAL UX: Show validation errors only on submit attempt
    setIsSubmitted(true);

    if (!validateForm()) {
      setError('Please fix validation errors');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
      const roleName = selectedRole?.name;
      
      // ✅ DEPARTMENT HANDLING: TL uses departmentName, others use departmentId
      let departmentIdValue = null;
      let departmentNameValue = null;
      
      // ✅ DESIGNATION HANDLING: TL uses designationName, others use designationId
      let designationIdValue = null;
      let designationNameValue = null;
      
      // ✅ TEAM HANDLING: TL uses teamName, others use teamId
      let teamIdValue = null;
      let teamNameValue = null;
      
      // ✅ REPORTING MANAGER HANDLING: TL uses managerName, others use managerId
      let reportingManagerIdValue = null;
      let reportingManagerNameValue = null;
      
      if (roleName === 'TL') {
        // TL: Use string values
        departmentNameValue = formData.departmentId || null;
        designationNameValue = formData.designationId || null;
        teamNameValue = formData.teamId || null;
        reportingManagerNameValue = formData.reportingManagerId || null;
      } else {
        // Non-TL: Use ID values
        departmentIdValue = formData.departmentId ? parseInt(formData.departmentId) : null;
        designationIdValue = formData.designationId && formData.designationId !== 'other' ? parseInt(formData.designationId) : null;
        teamIdValue = formData.teamId && formData.teamId !== 'other' ? parseInt(formData.teamId) : null;
        reportingManagerIdValue = formData.reportingManagerId ? parseInt(formData.reportingManagerId) : null;
      }
      
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.employeeId,
        userId: formData.userId,
        roleId: formData.roleId ? parseInt(formData.roleId) : null,
        // ✅ CRITICAL FIX: Send correct fields based on role
        departmentId: departmentIdValue,
        departmentName: departmentNameValue,
        designationId: designationIdValue,
        designationName: designationNameValue,
        teamId: teamIdValue,
        teamName: teamNameValue,
        reportingManagerId: reportingManagerIdValue,
        reportingManagerName: reportingManagerNameValue,
        // ✅ NEW: TL assignment for EMPLOYEE role
        tlId: roleName === 'EMPLOYEE' ? (formData.tlId ? parseInt(formData.tlId) : null) : null,
        organizationId: formData.organizationId ? parseInt(formData.organizationId) : 1,
        hiredAt: formData.hiredAt ? new Date(formData.hiredAt).toISOString().split('T')[0] : null,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString().split('T')[0] : null,
        gender: formData.gender,
        status: formData.status ? formData.status.toUpperCase() : 'ACTIVE',
        attendanceAllowed: formData.attendanceAllowed,
        // Include custom values
        customTeam: formData.teamId === 'other' ? formData.customTeam : null,
        customDesignation: formData.designationId === 'other' ? formData.customDesignation : null,
        // Include profile image if available
        profileImageBase64: formData.profileImageBase64 || null
      };
      
      console.log('Sending payload:', payload);
      
      let response;
      if (editingEmployee) {
        // Update existing employee
        response = await backendApi.put(`/employees/${editingEmployee.id}`, payload);
        alert('Employee updated successfully!');
      } else {
        // Create new employee
        response = await backendApi.post('/employees', payload);
        alert('Employee created successfully!');
      }
      
      // Show success message
      if (isModal && onSuccess) {
        onSuccess();
      } else {
        router.push('/employees');
      }
      
    } catch (err) {
      setError(editingEmployee ? 'Failed to update employee' : 'Failed to create employee');
      console.error('Error saving employee:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isModal && onSuccess) {
      onSuccess();
    } else {
      router.push('/employees');
    }
  };

  if (loading) {
    if (isModal) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading form...</div>
        </div>
      );
    }
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading form...</div>
        </div>
      </DashboardLayout>
    );
  }

  const formContent = (
    <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        {!isModal && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Add New Employee</h1>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {[1, 2].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNumber 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {stepNumber}
                  </div>
                  {stepNumber < totalSteps && (
                    <div className={`w-16 h-1 mx-2 ${
                      step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>Basic Information</span>
            <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>Organizational Details</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {isSubmitted && error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-t-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="p-6">
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User size={18} />
                    Basic Information
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter first name"
                    />
                    {isSubmitted && formErrors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter last name"
                    />
                    {isSubmitted && formErrors.lastName && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter email address"
                    />
                    {isSubmitted && formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter phone number"
                    />
                    {isSubmitted && formErrors.phone && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {isSubmitted && formErrors.dateOfBirth && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.dateOfBirth}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Image
                    </label>
                    <div className="space-y-3">
                      {formData.profileImage && (
                        <div className="flex items-center justify-center mb-4">
                          <img
                            src={formData.profileImage}
                            alt="Profile Preview"
                            className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, profileImage: null, profileImageBase64: '' }))}
                            className="ml-4 px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                          >
                            Remove Image
                          </button>
                        </div>
                      )}

                      <div className="flex items-center space-x-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="profile-image-input"
                        />
                        <label
                          htmlFor="profile-image-input"
                          className="flex-1 cursor-pointer bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors"
                        >
                          <div className="text-center">
                            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
</svg>
                            <p className="mt-2 text-sm text-gray-600">
                              Click to upload or drag and drop your profile image
                            </p>
                            <p className="text-xs text-gray-500">
                              PNG, JPG, GIF up to 10MB
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Organizational Details */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 size={18} />
                    Organizational Details
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee ID *
                    </label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.employeeId ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter employee ID"
                    />
                    {isSubmitted && formErrors.employeeId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.employeeId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      name="roleId"
                      value={formData.roleId}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.roleId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {isSubmitted && formErrors.roleId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.roleId}</p>
                    )}
                  </div>

                  {/* ✅ CONDITIONAL TL DROPDOWN (EMPLOYEE only) */}
                  {(() => {
                    const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
                    const roleName = selectedRole?.name;
                    return roleName === 'EMPLOYEE';
                  })() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Team Lead (TL) *
                      </label>
                      <select
                        value={formData.tlId || ''}
                        onChange={(e) => handleTLChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select TL</option>
                        {tlList.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.firstName} {tl.lastName} ({tl.departmentName || 'N/A'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ✅ CONDITIONAL DEPARTMENT FIELD */}
                  {(() => {
                    const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
                    const roleName = selectedRole?.name;
                    // Show department field for EMPLOYEE (read-only via TL) or TL (editable)
                    return roleName === 'EMPLOYEE' || roleName === 'TL';
                  })() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department {(() => {
                          const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
                          return selectedRole?.name === 'EMPLOYEE' ? '(via TL)' : '*';
                        })()}
                      </label>
                      {(() => {
                        const selectedRole = roles.find(r => r.id === parseInt(formData.roleId));
                        const isEmployee = selectedRole?.name === 'EMPLOYEE';
                        
                        if (isEmployee) {
                          // For EMPLOYEE: show read-only department from TL
                          return (
                            <input
                              type="text"
                              value={formData.departmentName ? `${formData.departmentName} (via ${tlList.find(t => t.id === formData.tlId)?.firstName || 'TL'})` : ''}
                              disabled
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600"
                            />
                          );
                        } else {
                          // For TL: show editable department dropdown
                          return (
                            <select
                              name="departmentId"
                              value={formData.departmentId || ''}
                              onChange={handleChange}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.departmentId ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select Department</option>
                              {departments.map((dept, index) => {
                                if (!dept) return null;
                                const label =
                                  typeof dept === 'string'
                                    ? dept
                                    : dept?.name || '';
                                if (!label.trim()) return null;
                                return (
                                  <option key={`dept-${label}-${index}`} value={label}>
                                    {label}
                                  </option>
                                );
                              }).filter(Boolean)}
                            </select>
                          );
                        }
                      })()}
                      {isSubmitted && formErrors.departmentId && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.departmentId}</p>
                      )}
                    </div>
                  )}

                  {/* ✅ CONDITIONAL DEPARTMENT FIELD (TL only) - REMOVED: Handled in unified section above */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reporting Manager
                    </label>
                    <select
                      name="reportingManagerId"
                      value={formData.reportingManagerId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Manager</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Team *
                    </label>
                    <select
                      name="teamId"
                      value={formData.teamId}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.teamId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Team</option>
                      {teams.map((team) => {
                        // ✅ EXTRA SAFETY: Handle null/undefined team data
                        if (!team || !team.id) return null;
                        
                        return (
                          <option key={team.id} value={team.id}>
                            {team.name || 'Unknown'}
                          </option>
                        );
                      }).filter(Boolean)} {/* ✅ Remove null options */}
                      <option value="other">Other (Specify)</option>
                    </select>
                    {isSubmitted && formErrors.teamId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teamId}</p>
                    )}
                    
                    {/* Custom team input */}
                    {formData.teamId === 'other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          name="customTeam"
                          value={formData.customTeam}
                          onChange={handleChange}
                          placeholder="Enter custom team name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Designation *
                    </label>
                    <select
                      name="designationId"
                      value={
                      typeof formData.designationId === 'object'
                        ? formData.designationId.id
                        : formData.designationId || ''
                    }
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.designationId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Designation</option>
                      {designations.map((designation) => {
                        // ✅ EXTRA SAFETY: Handle null/undefined designation data
                        if (!designation || !designation.id) return null;
                        
                        return (
                          <option key={designation.id} value={designation.id}>
                            {designation.name || 'Unknown'}
                          </option>
                        );
                      }).filter(Boolean)} {/* ✅ Remove null options */}
                      <option value="other">Other (Specify)</option>
                    </select>
                    {isSubmitted && formErrors.designationId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.designationId}</p>
                    )}
                    
                    {/* Custom designation input */}
                    {formData.designationId === 'other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          name="customDesignation"
                          value={formData.customDesignation}
                          onChange={handleChange}
                          placeholder="Enter custom designation"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hire Date *
                    </label>
                    <input
                      type="date"
                      name="hiredAt"
                      value={formData.hiredAt}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.hiredAt ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.hiredAt && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.hiredAt}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter emergency contact name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.emergencyPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter emergency phone number"
                    />
                    {formErrors.emergencyPhone && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.emergencyPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Email
                    </label>
                    <input
                      type="email"
                      name="workEmail"
                      value={formData.workEmail}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.workEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter work email"
                    />
                    {formErrors.workEmail && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.workEmail}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Personal Email
                    </label>
                    <input
                      type="email"
                      name="personalEmail"
                      value={formData.personalEmail}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter personal email"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={step === 1}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex gap-4">
                {step < totalSteps ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving || step !== totalSteps}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="ml-2">{editingEmployee ? 'Updating Employee...' : 'Creating Employee...'}</span>
                      </div>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>{editingEmployee ? 'Update Employee' : 'Create Employee'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
  );

  if (isModal) {
    return formContent;
  }

  return (
    <DashboardLayout>
      {formContent}
    </DashboardLayout>
  );
}
